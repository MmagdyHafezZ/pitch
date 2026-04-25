# P.I.T.C.H. Final Report Performance Scaffold (Kubernetes)

Date: 2026-04-23

## Purpose

This dataset captures the final performance-evaluation campaign against the IBM
Kubernetes deployment of P.I.T.C.H. using an external k6 load generator. It is
intended to replace the earlier development-host measurements as the primary
final-report dataset while preserving the experiment families that are
executable in the current deployment.

## Current Dataset Context

The final dataset targets the public Kubernetes deployment at
https://api.pitchapp.ca. Load is generated from a separate client machine, and
the results are organized by workload family so the final report can quantify
steady-state latency, throughput, error rate, overload behavior, and
application-instance scaling without mixing them with the older co-located
midterm dataset.

## Execution Topology

- SUT deployment: Kubernetes deployment exposed at https://api.pitchapp.ca. For
  k6, use BASE_URL=https://api.pitchapp.ca because the workload scripts append
  /api/v1 paths internally.
- Load generator mode: separate
- Topology note: The system under test runs on Kubernetes and the k6 load
  generator runs from a separate client machine. This reduces the same-host
  interference present in the earlier development-host dataset, although
  public-network variability and managed-platform behavior can still affect
  latency measurements.

## Threats to Validity

- Kubernetes is a managed platform, so public-network variability, platform
  scheduling behavior, and instance lifecycle events can influence end-to-end
  latency in addition to application logic.
- If the deployment is a single Kubernetes application rather than independently
  deployed backend services, scaling results should be interpreted as
  application-instance scaling rather than isolated per-service bottleneck
  scaling.
- The current application does not expose a verified cache-off toggle, so
  cache-comparison results are out of scope for this final dataset unless that
  runtime gate is implemented later.

## Limitation Handling

- Keep this external Kubernetes dataset analytically separate from the older
  co-located development-host dataset.
- If autoscaling or instance-count changes are part of the experiment, report
  the exact Kubernetes scaling settings used for each run.
- Avoid claiming service-level causality unless the deployment shape and
  observability evidence actually support that level of attribution.

## Host Machine

- model: MacBook Pro (Mac16,8)
- processor: Apple M4 Pro
- CPU cores: 12 (8 Performance and 4 Efficiency)
- memory: 24 GB
- operating system: macOS 26.4 (25E246)
- kernel: Darwin 25.4.0

## Experiment Coverage

| Experiment                              | Planned scenarios | Measured scenarios | Expected runs | Valid runs | Incomplete runs | Status      |
| --------------------------------------- | ----------------: | -----------------: | ------------: | ---------: | --------------: | ----------- |
| Baseline characterization               |                 1 |                  1 |             2 |          1 |               0 | partial     |
| Light API load scaling                  |                 5 |                  1 |            25 |          1 |               0 | partial     |
| AI-intensive load scaling               |                 3 |                  1 |            15 |          1 |               0 | partial     |
| Mixed workload scaling                  |                 3 |                  1 |            15 |          1 |               0 | partial     |
| Spike and stress testing                |                 2 |                  0 |             6 |          0 |               0 | not-started |
| Kubernetes application instance scaling |                 3 |                  0 |            15 |          0 |               0 | not-started |

## Scenario Metrics

| Experiment                              | Scenario                  | Valid runs | Incomplete runs | Mean latency (ms, 95% CI) | P95 (ms, 95% CI) | P99 (ms, 95% CI) | Throughput (req/s, 95% CI) | Error rate (%, 95% CI) |
| --------------------------------------- | ------------------------- | ---------: | --------------: | ------------------------- | ---------------- | ---------------- | -------------------------- | ---------------------- |
| Baseline characterization               | baseline                  |          1 |               0 | 369.19                    | 658.70           | 801.32           | 0.49                       | 0.00                   |
| Light API load scaling                  | light / 10 VUs            |          1 |               0 | 311.96                    | 527.35           | 790.59           | 5.59                       | 0.00                   |
| Light API load scaling                  | light / 50 VUs            |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Light API load scaling                  | light / 100 VUs           |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Light API load scaling                  | light / 200 VUs           |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Light API load scaling                  | light / 500 VUs           |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| AI-intensive load scaling               | AI-intensive / 10 VUs     |          1 |               0 | 6430.14                   | 8466.66          | 8935.18          | 0.98                       | 0.00                   |
| AI-intensive load scaling               | AI-intensive / 50 VUs     |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| AI-intensive load scaling               | AI-intensive / 100 VUs    |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Mixed workload scaling                  | mixed / 10 VUs            |          1 |               0 | 2053.73                   | 6960.24          | 8017.91          | 2.88                       | 0.00                   |
| Mixed workload scaling                  | mixed / 50 VUs            |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Mixed workload scaling                  | mixed / 100 VUs           |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Spike and stress testing                | spike / light             |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Spike and stress testing                | stress / light            |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Kubernetes application instance scaling | app scaling / 1 instance  |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Kubernetes application instance scaling | app scaling / 2 instances |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Kubernetes application instance scaling | app scaling / 4 instances |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |

## Planned But Not Yet Collected

- light / 50 VUs (`light/vus-50`), expected runs: 5. Notes: No result files were
  found for this scenario yet.
- light / 100 VUs (`light/vus-100`), expected runs: 5. Notes: No result files
  were found for this scenario yet.
- light / 200 VUs (`light/vus-200`), expected runs: 5. Notes: No result files
  were found for this scenario yet.
- light / 500 VUs (`light/vus-500`), expected runs: 5. Notes: No result files
  were found for this scenario yet.
- AI-intensive / 50 VUs (`ai/vus-50`), expected runs: 5. Notes: No result files
  were found for this scenario yet.
- AI-intensive / 100 VUs (`ai/vus-100`), expected runs: 5. Notes: No result
  files were found for this scenario yet.
- mixed / 50 VUs (`mixed/vus-50`), expected runs: 5. Notes: No result files were
  found for this scenario yet.
- mixed / 100 VUs (`mixed/vus-100`), expected runs: 5. Notes: No result files
  were found for this scenario yet.
- spike / light (`spike/light`), expected runs: 3. Notes: No result files were
  found for this scenario yet.
- stress / light (`stress/light`), expected runs: 3. Notes: No result files were
  found for this scenario yet.
- app scaling / 1 instance (`scaling/app-instances-1`), expected runs: 5. Notes:
  No result files were found for this scenario yet.
- app scaling / 2 instances (`scaling/app-instances-2`), expected runs: 5.
  Notes: No result files were found for this scenario yet.
- app scaling / 4 instances (`scaling/app-instances-4`), expected runs: 5.
  Notes: No result files were found for this scenario yet.

## Scenario Notes

- baseline: Collect low-load baseline runs against the public Kubernetes
  endpoint before the scaling campaigns begin.

## Generated Assets

## Final Report Guidance

- Collect the full experiment matrix from the public Kubernetes deployment using
  the external runner.
- Record the exact Kubernetes deployment shape, scaling settings, and runtime
  configuration used for every campaign.
- Correlate latency cliffs and failure behavior with Kubernetes pod metrics,
  RabbitMQ activity, Redis behavior, and database observations before drawing
  bottleneck conclusions.
- Use this scaffold output as the primary performance-results source for the
  final report.
