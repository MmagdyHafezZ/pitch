# Performance Evaluation Runbook

This directory now supports a reusable final-report workflow instead of only the
March 15 midterm snapshot.

## What Changed

- `scripts/generate_perf_report.py` reads a dataset metadata file and produces:
  - a markdown report scaffold
  - a machine-readable JSON summary
  - optional charts for experiments with numeric x-axis values
- `perf/report_datasets/current-dev-host.json` records the current dataset,
  planned experiment coverage, and the known topology limitation called out by
  the TA.

## Why This Matters

The previous flow was effectively midterm-only:

- hardcoded report date and title
- hardcoded light-workload scenarios
- handwritten narrative tied to one submission checkpoint

For the final deliverable, the report pipeline needs to do two things the
midterm flow did not:

1. Track what has actually been measured versus what was promised in the
   proposal.
2. Record whether a dataset came from a co-located load generator or an isolated
   setup.

The new metadata-driven flow does both.

## Current Limitation

The current measured dataset was collected with the `k6` load generator and the
system under test on the same machine. That means:

- load generation can compete with the gateway and services for CPU, memory, and
  networking
- measured bottlenecks may partly reflect host contention rather than only
  service saturation
- final-report claims should distinguish between `co-located dataset` findings
  and `isolated validation` findings

This should be either corrected in a new campaign or stated explicitly in the
final report. The generator now includes this note automatically from the
dataset metadata.

## Statistical Output

The scaffolded report surfaces the statistics directly in markdown:

- valid run counts
- incomplete run counts
- mean, P95, and P99 latency
- throughput
- error rate
- 95% confidence intervals for each metric when multiple valid runs exist

That keeps the statistical analysis visible in the report artifact instead of
hiding it only in code.

## Recommended Final Experiment Topology

Preferred setup:

- Machine A: P.I.T.C.H. gateway, services, Redis, RabbitMQ, databases,
  observability stack
- Machine B: `k6` load generator only

Minimum acceptable fallback:

- Separate VM or container host for `k6`, with the limitation documented in the
  dataset metadata

For every campaign, record:

- date and dataset ID
- SUT host and generator host
- whether the generator is `co-located` or `separate`
- workload family
- target VUs or traffic pattern
- expected repetitions
- any crashes, restarts, or incomplete runs

## Final Report Experiment Matrix

The concrete proposal and TA feedback imply the following matrix:

- Baseline characterization
- Light API load scaling
- AI-intensive load scaling
- Mixed workload scaling
- Spike testing
- Stress testing
- Bottleneck validation by scaling the suspected service
- Cache enabled vs disabled comparison

The current metadata file already lists these experiments, even when results are
still missing, so coverage gaps are visible in generated output.

## Running The Generator

From the repo root:

```bash
python3 scripts/generate_perf_report.py
```

With an explicit dataset config:

```bash
python3 scripts/generate_perf_report.py --config perf/report_datasets/current-dev-host.json
```

Outputs for the current dataset are written to:

- `output/doc/pitch_final_report_perf_scaffold_2026-04-23.md`
- `output/doc/pitch_final_report_perf_scaffold_2026-04-23.json`

## Adding A New Dataset

1. Copy `perf/report_datasets/current-dev-host.json` to a new dataset file.
2. Update the dataset ID, report date, output paths, and topology metadata.
3. Point each scenario path at the new results folders under `perf/results`.
4. Run `python3 scripts/generate_perf_report.py --config <new-config>`.

If a scenario folder is missing, the scaffold will mark it as planned but not
yet collected instead of silently dropping it.
