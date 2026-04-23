# P.I.T.C.H. Final Report Performance Scaffold (IBM Code Engine)

Date: 2026-04-23

## Purpose

This dataset captures the final performance-evaluation campaign against the IBM
Code Engine deployment of P.I.T.C.H. using an external k6 load generator. It is
intended to replace the earlier development-host measurements as the primary
final-report dataset while preserving the same experiment families promised in
the proposal.

## Current Dataset Context

The final dataset targets the public IBM Code Engine deployment at
https://api.pitchapp.ca. Load is generated from a separate client machine, and
the results are organized by workload family so the final report can quantify
steady-state latency, throughput, error rate, overload behavior, and scaling
effects without mixing them with the older co-located midterm dataset.

## Execution Topology

- SUT deployment: IBM Cloud Code Engine deployment exposed at
  https://api.pitchapp.ca. For k6, use BASE_URL=https://api.pitchapp.ca because
  the workload scripts append /api/v1 paths internally.
- Load generator mode: separate
- Topology note: The system under test runs on IBM Code Engine and the k6 load
  generator runs from a separate client machine. This reduces the same-host
  interference present in the earlier development-host dataset, although
  public-network variability and managed-platform behavior can still affect
  latency measurements.

## Threats to Validity

- IBM Code Engine is a managed platform, so public-network variability, platform
  scheduling behavior, and instance lifecycle events can influence end-to-end
  latency in addition to application logic.
- If the deployment is a single Code Engine application rather than
  independently deployed backend services, scaling results should be interpreted
  as application-instance scaling rather than isolated per-service bottleneck
  scaling.
- Cache-comparison results are only valid if the cache state was changed by a
  real deployment or runtime configuration change instead of only by tagging the
  workload.

## Limitation Handling

- Keep this external Code Engine dataset analytically separate from the older
  co-located development-host dataset.
- If autoscaling or instance-count changes are part of the experiment, report
  the exact Code Engine scaling settings used for each run.
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

| Experiment                               | Planned scenarios | Measured scenarios | Expected runs | Valid runs | Incomplete runs | Status      |
| ---------------------------------------- | ----------------: | -----------------: | ------------: | ---------: | --------------: | ----------- |
| Baseline characterization                |                 1 |                  0 |             2 |          0 |               0 | not-started |
| Light API load scaling                   |                 5 |                  0 |            25 |          0 |               0 | not-started |
| AI-intensive load scaling                |                 3 |                  0 |            15 |          0 |               0 | not-started |
| Mixed workload scaling                   |                 3 |                  0 |            15 |          0 |               0 | not-started |
| Spike and stress testing                 |                 2 |                  0 |             6 |          0 |               0 | not-started |
| Code Engine application instance scaling |                 3 |                  0 |            15 |          0 |               0 | not-started |
| Cache validation                         |                 2 |                  0 |            10 |          0 |               0 | not-started |

## Scenario Metrics

| Experiment                               | Scenario                    | Valid runs | Incomplete runs | Mean latency (ms, 95% CI) | P95 (ms, 95% CI) | P99 (ms, 95% CI) | Throughput (req/s, 95% CI) | Error rate (%, 95% CI) |
| ---------------------------------------- | --------------------------- | ---------: | --------------: | ------------------------- | ---------------- | ---------------- | -------------------------- | ---------------------- |
| Baseline characterization                | baseline                    |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Light API load scaling                   | light / 10 VUs              |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Light API load scaling                   | light / 50 VUs              |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Light API load scaling                   | light / 100 VUs             |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Light API load scaling                   | light / 200 VUs             |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Light API load scaling                   | light / 500 VUs             |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| AI-intensive load scaling                | AI-intensive / 10 VUs       |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| AI-intensive load scaling                | AI-intensive / 50 VUs       |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| AI-intensive load scaling                | AI-intensive / 100 VUs      |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Mixed workload scaling                   | mixed / 10 VUs              |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Mixed workload scaling                   | mixed / 50 VUs              |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Mixed workload scaling                   | mixed / 100 VUs             |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Spike and stress testing                 | spike / light               |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Spike and stress testing                 | stress / light              |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Code Engine application instance scaling | app scaling / 1 instance    |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Code Engine application instance scaling | app scaling / 2 instances   |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Code Engine application instance scaling | app scaling / 4 instances   |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Cache validation                         | cache comparison / enabled  |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Cache validation                         | cache comparison / disabled |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |

## Planned But Not Yet Collected

- baseline (`baseline`), expected runs: 2. Notes: Collect low-load baseline runs
  against the public Code Engine endpoint before the scaling campaigns begin. No
  result files were found for this scenario yet.
- light / 10 VUs (`light/vus-10`), expected runs: 5. Notes: No result files were
  found for this scenario yet.
- light / 50 VUs (`light/vus-50`), expected runs: 5. Notes: No result files were
  found for this scenario yet.
- light / 100 VUs (`light/vus-100`), expected runs: 5. Notes: No result files
  were found for this scenario yet.
- light / 200 VUs (`light/vus-200`), expected runs: 5. Notes: No result files
  were found for this scenario yet.
- light / 500 VUs (`light/vus-500`), expected runs: 5. Notes: No result files
  were found for this scenario yet.
- AI-intensive / 10 VUs (`ai/vus-10`), expected runs: 5. Notes: No result files
  were found for this scenario yet.
- AI-intensive / 50 VUs (`ai/vus-50`), expected runs: 5. Notes: No result files
  were found for this scenario yet.
- AI-intensive / 100 VUs (`ai/vus-100`), expected runs: 5. Notes: No result
  files were found for this scenario yet.
- mixed / 10 VUs (`mixed/vus-10`), expected runs: 5. Notes: No result files were
  found for this scenario yet.
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
- cache comparison / enabled (`cache-comparison/enabled`), expected runs: 5.
  Notes: Only treat this as measured if cache behavior was changed by a real
  deployment or runtime configuration change. No result files were found for
  this scenario yet.
- cache comparison / disabled (`cache-comparison/disabled`), expected runs: 5.
  Notes: Do not report this scenario as complete unless the cache-disabled state
  is real and reproducible. No result files were found for this scenario yet.

## Generated Assets

## Final Report Guidance

- Collect the full experiment matrix from the public Code Engine deployment
  using the external runner.
- Record the exact Code Engine deployment shape, scaling settings, and runtime
  configuration used for every campaign.
- Correlate latency cliffs and failure behavior with Code Engine metrics,
  RabbitMQ activity, Redis behavior, and database observations before drawing
  bottleneck conclusions.
- Use this scaffold output as the primary performance-results source for the
  final report.
