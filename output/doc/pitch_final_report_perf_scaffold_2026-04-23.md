# P.I.T.C.H. Final Report Performance Scaffold

Date: 2026-04-23

## Purpose

This scaffold turns the current midterm-only performance results into a reusable
final-report input. It keeps the collected light-workload data analyzable, makes
missing experiments explicit, and records the current topology limitation so the
final report can distinguish development-host findings from isolated validation
runs.

## Current Dataset Context

The current measured dataset covers baseline characterization plus light API
load scaling from 10 to 500 VUs. It reflects the same work described in the
initial proposal, the concrete project proposal, and the March 15, 2026 midterm
report, but it is now framed as one dataset inside the final-report pipeline
instead of the whole report.

## Execution Topology

- SUT deployment: Dockerized gateway and backend services running on a single
  MacBook Pro development host.
- Load generator mode: co-located
- Topology note: The current k6 load generator and all tested P.I.T.C.H.
  services ran on the same machine, so generator CPU, memory, and network
  activity may perturb the measured service latency and throughput.

## Threats to Validity

- The current dataset was collected with co-located load generation, so absolute
  latency and throughput values may include interference from the generator
  itself instead of only the system under test.
- High-load collapse runs are preserved instead of discarded; they are useful
  evidence of instability, but they should not be averaged with valid
  steady-state runs.
- The proposal called for separate-machine load generation and tighter control
  of background processes. Those controls were not fully satisfied for the
  current dataset and should be treated as a limitation, not silently assumed
  away.

## Limitation Handling

- Treat the current co-located dataset as evidence of trend shape, instability
  thresholds, and overload behavior, not as the final word on exact latency
  numbers or bottleneck attribution.
- Keep co-located and isolated campaigns as separate datasets in the final
  report instead of averaging them together.
- If an isolated campaign cannot be collected in time, retain this limitation
  prominently in the final report and avoid strong causal claims about the
  gateway or any downstream service.

## Host Machine

- model: MacBook Pro (Mac16,8)
- processor: Apple M4 Pro
- CPU cores: 12 (8 Performance and 4 Efficiency)
- memory: 24 GB
- operating system: macOS 26.4 (25E246)
- kernel: Darwin 25.4.0

## Experiment Coverage

| Experiment                   | Planned scenarios | Measured scenarios | Expected runs | Valid runs | Incomplete runs | Status                |
| ---------------------------- | ----------------: | -----------------: | ------------: | ---------: | --------------: | --------------------- |
| Baseline characterization    |                 1 |                  1 |             2 |          2 |               1 | partial-with-failures |
| Light API load scaling       |                 5 |                  5 |            25 |         21 |               3 | partial-with-failures |
| AI-intensive load scaling    |                 3 |                  0 |            15 |          0 |               0 | not-started           |
| Mixed workload scaling       |                 3 |                  0 |            15 |          0 |               0 | not-started           |
| Spike and stress testing     |                 2 |                  0 |             6 |          0 |               0 | not-started           |
| Replica and cache validation |                 2 |                  0 |            10 |          0 |               0 | not-started           |

## Scenario Metrics

| Experiment                   | Scenario                               | Valid runs | Incomplete runs | Mean latency (ms, 95% CI) | P95 (ms, 95% CI)    | P99 (ms, 95% CI)        | Throughput (req/s, 95% CI) | Error rate (%, 95% CI) |
| ---------------------------- | -------------------------------------- | ---------: | --------------: | ------------------------- | ------------------- | ----------------------- | -------------------------- | ---------------------- |
| Baseline characterization    | baseline                               |          2 |               1 | 3.33 +/- 0.06             | 7.81 +/- 0.30       | 8.56 +/- 16.78          | 13.44 +/- 0.17             | 0.00 +/- 0.00          |
| Light API load scaling       | light / 10 VUs                         |          5 |               0 | 3.41 +/- 0.14             | 8.35 +/- 0.65       | 16.90 +/- 1.03          | 13.43 +/- 0.04             | 0.00 +/- 0.00          |
| Light API load scaling       | light / 50 VUs                         |          5 |               0 | 82.85 +/- 23.26           | 229.84 +/- 149.16   | 2589.82 +/- 1044.37     | 48.95 +/- 3.95             | 0.00 +/- 0.00          |
| Light API load scaling       | light / 100 VUs                        |          4 |               0 | 156.58 +/- 20.19          | 844.77 +/- 123.79   | 3999.72 +/- 769.53      | 87.70 +/- 8.12             | 0.00 +/- 0.00          |
| Light API load scaling       | light / 200 VUs                        |          5 |               0 | 6624.51 +/- 12093.87      | 2390.95 +/- 2008.53 | 310982.23 +/- 594463.50 | 102.40 +/- 54.77           | 13.79 +/- 7.14         |
| Light API load scaling       | light / 500 VUs                        |          2 |               3 | 1060.99 +/- 1196.48       | 4290.31 +/- 489.55  | 37316.64 +/- 57851.96   | 237.71 +/- 187.00          | 21.96 +/- 41.62        |
| AI-intensive load scaling    | AI-intensive / 10 VUs                  |          0 |               0 | n/a                       | n/a                 | n/a                     | n/a                        | n/a                    |
| AI-intensive load scaling    | AI-intensive / 50 VUs                  |          0 |               0 | n/a                       | n/a                 | n/a                     | n/a                        | n/a                    |
| AI-intensive load scaling    | AI-intensive / 100 VUs                 |          0 |               0 | n/a                       | n/a                 | n/a                     | n/a                        | n/a                    |
| Mixed workload scaling       | mixed / 10 VUs                         |          0 |               0 | n/a                       | n/a                 | n/a                     | n/a                        | n/a                    |
| Mixed workload scaling       | mixed / 50 VUs                         |          0 |               0 | n/a                       | n/a                 | n/a                     | n/a                        | n/a                    |
| Mixed workload scaling       | mixed / 100 VUs                        |          0 |               0 | n/a                       | n/a                 | n/a                     | n/a                        | n/a                    |
| Spike and stress testing     | spike / light                          |          0 |               0 | n/a                       | n/a                 | n/a                     | n/a                        | n/a                    |
| Spike and stress testing     | stress / light                         |          0 |               0 | n/a                       | n/a                 | n/a                     | n/a                        | n/a                    |
| Replica and cache validation | replica scaling / suspected bottleneck |          0 |               0 | n/a                       | n/a                 | n/a                     | n/a                        | n/a                    |
| Replica and cache validation | cache comparison / on-off              |          0 |               0 | n/a                       | n/a                 | n/a                     | n/a                        | n/a                    |

## Planned But Not Yet Collected

- AI-intensive / 10 VUs (`load-scaling/ai/vus-10`), expected runs: 5. Notes: No
  result files were found for this scenario yet.
- AI-intensive / 50 VUs (`load-scaling/ai/vus-50`), expected runs: 5. Notes: No
  result files were found for this scenario yet.
- AI-intensive / 100 VUs (`load-scaling/ai/vus-100`), expected runs: 5. Notes:
  No result files were found for this scenario yet.
- mixed / 10 VUs (`load-scaling/mixed/vus-10`), expected runs: 5. Notes: No
  result files were found for this scenario yet.
- mixed / 50 VUs (`load-scaling/mixed/vus-50`), expected runs: 5. Notes: No
  result files were found for this scenario yet.
- mixed / 100 VUs (`load-scaling/mixed/vus-100`), expected runs: 5. Notes: No
  result files were found for this scenario yet.
- spike / light (`spike/light`), expected runs: 3. Notes: No result files were
  found for this scenario yet.
- stress / light (`stress/light`), expected runs: 3. Notes: No result files were
  found for this scenario yet.
- replica scaling / suspected bottleneck (`scaling/bottleneck-service`),
  expected runs: 5. Notes: No result files were found for this scenario yet.
- cache comparison / on-off (`cache-comparison`), expected runs: 5. Notes: No
  result files were found for this scenario yet.

## Scenario Notes

- baseline: One baseline JSON exists but is incomplete; the expected valid
  baseline count is two.
- light / 100 VUs: Only four valid runs are currently present.
- light / 500 VUs: Three of the five collected runs are collapse runs and should
  remain separated from valid averages.

## Incomplete Or Collapse Runs

| Scenario        | Run file                      | Mean latency (ms) | P95 (ms) | P99 (ms) | Throughput (req/s) | Error rate (%) |
| --------------- | ----------------------------- | ----------------: | -------: | -------: | -----------------: | -------------: |
| baseline        | baseline-20260313-071931.json |              0.00 |     0.00 |     0.00 |              13.22 |         100.00 |
| light / 500 VUs | run-3.json                    |              0.00 |     0.00 |     0.00 |             108.94 |         100.00 |
| light / 500 VUs | run-4.json                    |              0.00 |     0.00 |     0.00 |             490.96 |         100.00 |
| light / 500 VUs | run-5.json                    |              0.00 |     0.00 |     0.00 |             746.20 |         100.00 |

## Generated Assets

- Light API load scaling:
  `output/doc/assets/current-dev-host_light-load-scaling_latency.png`,
  `output/doc/assets/current-dev-host_light-load-scaling_throughput_error.png`

## Final Report Guidance

- Collect at least one isolated validation campaign with the load generator on a
  separate machine or VM and compare it against the current co-located dataset.
- Correlate the observed light-workload latency cliff with gateway and
  service-level metrics from Prometheus and Grafana before claiming a bottleneck
  with confidence.
- Finish the missing AI-intensive, mixed, spike, stress, replica-scaling, and
  cache-comparison experiments so the final report answers the full proposal
  rather than only the midterm subset.
- Use this scaffold output as the source table for the final report, then add
  interpretation and service-level evidence on top of it.
