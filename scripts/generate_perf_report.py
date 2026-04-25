#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import os
import statistics
import subprocess
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
_cache_root = Path(tempfile.gettempdir()) / 'pitch-perf-report-cache'
_cache_root.mkdir(parents=True, exist_ok=True)
os.environ.setdefault('MPLCONFIGDIR', str(_cache_root / 'matplotlib'))
os.environ.setdefault('XDG_CACHE_HOME', str(_cache_root / 'xdg'))

try:
    import matplotlib.pyplot as plt
except Exception:  # pragma: no cover
    plt = None


@dataclass
class RunMetrics:
    scenario_id: str
    scenario_label: str
    file_name: str
    avg_ms: float
    p95_ms: float
    p99_ms: float
    rps: float
    error_rate: float
    req_count: int
    incomplete: bool


@dataclass
class ScenarioSummary:
    experiment_id: str
    scenario_id: str
    label: str
    path: str
    expected_runs: int
    collected_runs: int
    valid_runs: int
    incomplete_runs: int
    avg_ms: float | None
    avg_ms_ci95: float | None
    p95_ms: float | None
    p95_ms_ci95: float | None
    p99_ms: float | None
    p99_ms_ci95: float | None
    rps: float | None
    rps_ci95: float | None
    error_rate: float | None
    error_rate_ci95: float | None
    x_value: int | float | None
    notes: list[str]


@dataclass
class ExperimentCoverage:
    experiment_id: str
    label: str
    scenario_count: int
    measured_scenarios: int
    expected_total_runs: int
    collected_total_runs: int
    valid_total_runs: int
    incomplete_total_runs: int
    status: str


def repo_path(path_str: str) -> Path:
    return ROOT / path_str


def safe_metric(metrics: dict[str, Any], metric_name: str, stat: str, default: Any = 0) -> Any:
    value = metrics.get(metric_name, {}).get(stat, default)
    return default if value is None else value


def is_incomplete_run(metrics: dict[str, Any]) -> bool:
    req_count = safe_metric(metrics, 'http_reqs', 'count', 0)
    sent_count = safe_metric(metrics, 'data_sent', 'count', 0)
    received_count = safe_metric(metrics, 'data_received', 'count', 0)
    duration_avg = safe_metric(metrics, 'http_req_duration', 'avg', 0)
    duration_max = safe_metric(metrics, 'http_req_duration', 'max', 0)
    return (
        req_count > 0
        and sent_count == 0
        and received_count == 0
        and duration_avg == 0
        and duration_max == 0
    )


def load_run(path: Path, scenario_id: str, scenario_label: str) -> RunMetrics:
    data = json.loads(path.read_text())
    metrics = data['metrics']
    return RunMetrics(
        scenario_id=scenario_id,
        scenario_label=scenario_label,
        file_name=path.name,
        avg_ms=float(safe_metric(metrics, 'http_req_duration', 'avg', 0)),
        p95_ms=float(safe_metric(metrics, 'http_req_duration', 'p(95)', 0)),
        p99_ms=float(safe_metric(metrics, 'http_req_duration', 'p(99)', 0)),
        rps=float(safe_metric(metrics, 'http_reqs', 'rate', 0)),
        error_rate=float(safe_metric(metrics, 'http_req_failed', 'value', 0)),
        req_count=int(safe_metric(metrics, 'http_reqs', 'count', 0)),
        incomplete=is_incomplete_run(metrics),
    )


def ci95(values: list[float]) -> float | None:
    if len(values) <= 1:
        return None
    return 1.96 * statistics.stdev(values) / math.sqrt(len(values))


def mean_or_none(values: list[float]) -> float | None:
    if not values:
        return None
    return statistics.mean(values)


def fmt(value: float | None, digits: int = 2, percent: bool = False) -> str:
    if value is None:
        return 'n/a'
    scaled = value * 100.0 if percent else value
    return f'{scaled:.{digits}f}'


def fmt_with_ci(value: float | None, ci_value: float | None, digits: int = 2, percent: bool = False) -> str:
    if value is None:
        return 'n/a'
    if ci_value is None:
        return fmt(value, digits=digits, percent=percent)
    scaled_value = value * 100.0 if percent else value
    scaled_ci = ci_value * 100.0 if percent else ci_value
    return f'{scaled_value:.{digits}f} +/- {scaled_ci:.{digits}f}'


def read_command_output(command: list[str]) -> str:
    try:
        completed = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
        )
    except Exception:
        return ''
    return completed.stdout


def get_host_specs() -> dict[str, str]:
    hardware_text = read_command_output(['system_profiler', 'SPHardwareDataType'])
    software_text = read_command_output(['system_profiler', 'SPSoftwareDataType'])

    def extract(label: str, text: str, fallback: str = 'unknown') -> str:
        prefix = f'{label}:'
        for line in text.splitlines():
            stripped = line.strip()
            if stripped.startswith(prefix):
                return stripped.split(':', 1)[1].strip()
        return fallback

    return {
        'model_name': extract('Model Name', hardware_text),
        'model_identifier': extract('Model Identifier', hardware_text),
        'chip': extract('Chip', hardware_text),
        'cpu_cores': extract('Total Number of Cores', hardware_text),
        'memory': extract('Memory', hardware_text),
        'macos_version': extract('System Version', software_text),
        'kernel_version': extract('Kernel Version', software_text),
    }


def load_config(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def load_scenario_runs(scenario: dict[str, Any], results_root: Path) -> list[RunMetrics]:
    scenario_path = results_root / scenario['path']
    if not scenario_path.exists():
        return []

    run_paths = sorted(scenario_path.glob('*.json'))
    return [load_run(run_path, scenario['id'], scenario['label']) for run_path in run_paths]


def summarize_scenario(experiment_id: str, scenario: dict[str, Any], runs: list[RunMetrics]) -> ScenarioSummary:
    valid_runs = [run for run in runs if not run.incomplete]

    def values(attr: str) -> list[float]:
        return [float(getattr(run, attr)) for run in valid_runs]

    notes = list(scenario.get('notes', []))
    if runs and not valid_runs:
        notes.append('All collected runs were classified as incomplete.')
    if not runs:
        notes.append('No result files were found for this scenario yet.')

    return ScenarioSummary(
        experiment_id=experiment_id,
        scenario_id=scenario['id'],
        label=scenario['label'],
        path=scenario['path'],
        expected_runs=int(scenario.get('expected_runs', 0)),
        collected_runs=len(runs),
        valid_runs=len(valid_runs),
        incomplete_runs=len([run for run in runs if run.incomplete]),
        avg_ms=mean_or_none(values('avg_ms')),
        avg_ms_ci95=ci95(values('avg_ms')),
        p95_ms=mean_or_none(values('p95_ms')),
        p95_ms_ci95=ci95(values('p95_ms')),
        p99_ms=mean_or_none(values('p99_ms')),
        p99_ms_ci95=ci95(values('p99_ms')),
        rps=mean_or_none(values('rps')),
        rps_ci95=ci95(values('rps')),
        error_rate=mean_or_none(values('error_rate')),
        error_rate_ci95=ci95(values('error_rate')),
        x_value=scenario.get('x_value'),
        notes=notes,
    )


def coverage_status(summary: ExperimentCoverage) -> str:
    if summary.valid_total_runs == 0:
        return 'not-started'
    if summary.incomplete_total_runs > 0:
        return 'partial-with-failures'
    if summary.expected_total_runs and summary.valid_total_runs < summary.expected_total_runs:
        return 'partial'
    if summary.measured_scenarios < summary.scenario_count:
        return 'partial'
    return 'measured'


def summarize_experiment(experiment: dict[str, Any], scenario_summaries: list[ScenarioSummary]) -> ExperimentCoverage:
    coverage = ExperimentCoverage(
        experiment_id=experiment['id'],
        label=experiment['label'],
        scenario_count=len(scenario_summaries),
        measured_scenarios=len([summary for summary in scenario_summaries if summary.collected_runs > 0]),
        expected_total_runs=sum(summary.expected_runs for summary in scenario_summaries),
        collected_total_runs=sum(summary.collected_runs for summary in scenario_summaries),
        valid_total_runs=sum(summary.valid_runs for summary in scenario_summaries),
        incomplete_total_runs=sum(summary.incomplete_runs for summary in scenario_summaries),
        status='unknown',
    )
    coverage.status = coverage_status(coverage)
    return coverage


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def build_experiment_charts(
    config: dict[str, Any],
    experiment: dict[str, Any],
    scenario_summaries: list[ScenarioSummary],
    output_dir: Path,
) -> list[str]:
    if plt is None:
        return []

    numeric_scenarios = [
        summary for summary in scenario_summaries if summary.x_value is not None and summary.valid_runs > 0
    ]
    if len(numeric_scenarios) < 2:
        return []

    numeric_scenarios.sort(key=lambda item: float(item.x_value))
    x = [float(summary.x_value) for summary in numeric_scenarios]

    latency_path = output_dir / f"{config['dataset_id']}_{experiment['id']}_latency.png"
    throughput_path = output_dir / f"{config['dataset_id']}_{experiment['id']}_throughput_error.png"

    plt.figure(figsize=(8, 4.8))
    plt.plot(x, [summary.avg_ms for summary in numeric_scenarios], marker='o', linewidth=2, label='Mean latency')
    plt.plot(x, [summary.p95_ms for summary in numeric_scenarios], marker='o', linewidth=2, label='P95 latency')
    plt.plot(x, [summary.p99_ms for summary in numeric_scenarios], marker='o', linewidth=2, label='P99 latency')
    plt.yscale('log')
    plt.xticks(x, [str(int(value)) if float(value).is_integer() else str(value) for value in x])
    plt.xlabel(experiment.get('x_axis_label', 'Scenario'))
    plt.ylabel('Latency (ms, log scale)')
    plt.title(f"{experiment['label']} latency")
    plt.grid(True, which='both', linestyle='--', linewidth=0.5, alpha=0.5)
    plt.legend()
    plt.tight_layout()
    plt.savefig(latency_path, dpi=200)
    plt.close()

    fig, ax1 = plt.subplots(figsize=(8, 4.8))
    ax1.plot(x, [summary.rps for summary in numeric_scenarios], color='#0b5ed7', marker='o', linewidth=2)
    ax1.set_xlabel(experiment.get('x_axis_label', 'Scenario'))
    ax1.set_ylabel('Throughput (req/s)', color='#0b5ed7')
    ax1.tick_params(axis='y', labelcolor='#0b5ed7')
    ax1.set_xticks(x, [str(int(value)) if float(value).is_integer() else str(value) for value in x])
    ax1.grid(True, linestyle='--', linewidth=0.5, alpha=0.5)

    ax2 = ax1.twinx()
    ax2.plot(
        x,
        [summary.error_rate * 100.0 for summary in numeric_scenarios],
        color='#c1121f',
        marker='s',
        linewidth=2,
    )
    ax2.set_ylabel('Error rate (%)', color='#c1121f')
    ax2.tick_params(axis='y', labelcolor='#c1121f')

    plt.title(f"{experiment['label']} throughput and error rate")
    plt.tight_layout()
    plt.savefig(throughput_path, dpi=200)
    plt.close()

    return [
        str(latency_path.relative_to(ROOT)),
        str(throughput_path.relative_to(ROOT)),
    ]


def build_markdown(
    config: dict[str, Any],
    host_specs: dict[str, str],
    scenario_summaries: list[ScenarioSummary],
    coverages: list[ExperimentCoverage],
    incomplete_runs: list[RunMetrics],
    chart_paths: dict[str, list[str]],
) -> str:
    experiment_labels = {experiment['id']: experiment['label'] for experiment in config['experiments']}

    lines: list[str] = [
        f"# {config['report_title']}",
        '',
        f"Date: {config['report_date']}",
        '',
        '## Purpose',
        '',
        config['purpose'],
        '',
        '## Current Dataset Context',
        '',
        config['dataset_summary'],
        '',
        '## Execution Topology',
        '',
        f"- SUT deployment: {config['environment']['sut_deployment']}",
        f"- Load generator mode: {config['environment']['load_generator_topology']['mode']}",
        f"- Topology note: {config['environment']['load_generator_topology']['summary']}",
        '',
        '## Threats to Validity',
        '',
    ]

    for note in config['notes']['threats_to_validity']:
        lines.append(f'- {note}')

    lines.extend([
        '',
        '## Limitation Handling',
        '',
    ])

    for item in config['notes']['limitation_handling']:
        lines.append(f'- {item}')

    lines.extend([
        '',
        '## Host Machine',
        '',
        f"- model: {host_specs['model_name']} ({host_specs['model_identifier']})",
        f"- processor: {host_specs['chip']}",
        f"- CPU cores: {host_specs['cpu_cores']}",
        f"- memory: {host_specs['memory']}",
        f"- operating system: {host_specs['macos_version']}",
        f"- kernel: {host_specs['kernel_version']}",
        '',
        '## Experiment Coverage',
        '',
        '| Experiment | Planned scenarios | Measured scenarios | Expected runs | Valid runs | Incomplete runs | Status |',
        '| --- | ---: | ---: | ---: | ---: | ---: | --- |',
    ])

    for coverage in coverages:
        lines.append(
            f"| {coverage.label} | {coverage.scenario_count} | {coverage.measured_scenarios} | "
            f"{coverage.expected_total_runs} | {coverage.valid_total_runs} | {coverage.incomplete_total_runs} | {coverage.status} |"
        )

    lines.extend([
        '',
        '## Scenario Metrics',
        '',
        '| Experiment | Scenario | Valid runs | Incomplete runs | Mean latency (ms, 95% CI) | P95 (ms, 95% CI) | P99 (ms, 95% CI) | Throughput (req/s, 95% CI) | Error rate (%, 95% CI) |',
        '| --- | --- | ---: | ---: | --- | --- | --- | --- | --- |',
    ])

    for summary in scenario_summaries:
        lines.append(
            f"| {experiment_labels[summary.experiment_id]} | {summary.label} | {summary.valid_runs} | {summary.incomplete_runs} | "
            f"{fmt_with_ci(summary.avg_ms, summary.avg_ms_ci95)} | {fmt_with_ci(summary.p95_ms, summary.p95_ms_ci95)} | "
            f"{fmt_with_ci(summary.p99_ms, summary.p99_ms_ci95)} | {fmt_with_ci(summary.rps, summary.rps_ci95)} | "
            f"{fmt_with_ci(summary.error_rate, summary.error_rate_ci95, percent=True)} |"
        )

    planned_only = [summary for summary in scenario_summaries if summary.collected_runs == 0]
    if planned_only:
        lines.extend([
            '',
            '## Planned But Not Yet Collected',
            '',
        ])
        for summary in planned_only:
            note_suffix = f" Notes: {' '.join(summary.notes)}" if summary.notes else ''
            lines.append(f"- {summary.label} (`{summary.path}`), expected runs: {summary.expected_runs}.{note_suffix}")

    noted_summaries = [summary for summary in scenario_summaries if summary.notes and summary.collected_runs > 0]
    if noted_summaries:
        lines.extend([
            '',
            '## Scenario Notes',
            '',
        ])
        for summary in noted_summaries:
            lines.append(f"- {summary.label}: {' '.join(summary.notes)}")

    if incomplete_runs:
        lines.extend([
            '',
            '## Incomplete Or Collapse Runs',
            '',
            '| Scenario | Run file | Mean latency (ms) | P95 (ms) | P99 (ms) | Throughput (req/s) | Error rate (%) |',
            '| --- | --- | ---: | ---: | ---: | ---: | ---: |',
        ])
        for run in incomplete_runs:
            lines.append(
                f"| {run.scenario_label} | {run.file_name} | {fmt(run.avg_ms)} | {fmt(run.p95_ms)} | "
                f"{fmt(run.p99_ms)} | {fmt(run.rps)} | {fmt(run.error_rate, percent=True)} |"
            )

    if chart_paths:
        lines.extend([
            '',
            '## Generated Assets',
            '',
        ])
        for experiment in config['experiments']:
            assets = chart_paths.get(experiment['id'], [])
            if assets:
                lines.append(f"- {experiment['label']}: {', '.join(f'`{asset}`' for asset in assets)}")

    lines.extend([
        '',
        '## Final Report Guidance',
        '',
    ])
    for step in config['notes']['final_delivery_focus']:
        lines.append(f'- {step}')

    return '\n'.join(lines) + '\n'


def build_json_summary(
    config: dict[str, Any],
    host_specs: dict[str, str],
    scenario_summaries: list[ScenarioSummary],
    coverages: list[ExperimentCoverage],
    incomplete_runs: list[RunMetrics],
    chart_paths: dict[str, list[str]],
) -> dict[str, Any]:
    return {
        'dataset_id': config['dataset_id'],
        'report_title': config['report_title'],
        'report_date': config['report_date'],
        'host_specs': host_specs,
        'environment': config['environment'],
        'coverage': [asdict(coverage) for coverage in coverages],
        'scenario_summaries': [asdict(summary) for summary in scenario_summaries],
        'incomplete_runs': [asdict(run) for run in incomplete_runs],
        'generated_assets': chart_paths,
    }


def analyze(config: dict[str, Any]) -> dict[str, Any]:
    results_root = repo_path(config['results_root'])
    output_markdown = repo_path(config['output_markdown'])
    output_json = repo_path(config['output_json'])
    assets_dir = repo_path(config['assets_dir'])

    ensure_parent(output_markdown)
    ensure_parent(output_json)
    assets_dir.mkdir(parents=True, exist_ok=True)

    host_specs = get_host_specs()
    scenario_summaries: list[ScenarioSummary] = []
    incomplete_runs: list[RunMetrics] = []
    coverages: list[ExperimentCoverage] = []
    chart_paths: dict[str, list[str]] = {}

    for experiment in config['experiments']:
        experiment_summaries: list[ScenarioSummary] = []
        for scenario in experiment['scenarios']:
            runs = load_scenario_runs(scenario, results_root)
            experiment_summaries.append(summarize_scenario(experiment['id'], scenario, runs))
            incomplete_runs.extend(run for run in runs if run.incomplete)

        scenario_summaries.extend(experiment_summaries)
        coverages.append(summarize_experiment(experiment, experiment_summaries))
        chart_paths[experiment['id']] = build_experiment_charts(config, experiment, experiment_summaries, assets_dir)

    output_markdown.write_text(
        build_markdown(
            config=config,
            host_specs=host_specs,
            scenario_summaries=scenario_summaries,
            coverages=coverages,
            incomplete_runs=incomplete_runs,
            chart_paths=chart_paths,
        )
    )

    output_json.write_text(
        json.dumps(
            build_json_summary(
                config=config,
                host_specs=host_specs,
                scenario_summaries=scenario_summaries,
                coverages=coverages,
                incomplete_runs=incomplete_runs,
                chart_paths=chart_paths,
            ),
            indent=2,
        )
        + '\n'
    )

    return {
        'markdown': str(output_markdown.relative_to(ROOT)),
        'json': str(output_json.relative_to(ROOT)),
        'assets': chart_paths,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Generate a metadata-driven performance report scaffold.')
    parser.add_argument(
        '--config',
        default='perf/report_datasets/current-dev-host.json',
        help='Path to the dataset config JSON, relative to the repo root.',
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = load_config(repo_path(args.config))
    summary = analyze(config)
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
