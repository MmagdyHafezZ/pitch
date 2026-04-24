# P.I.T.C.H. Final Project Report Draft

**Date:** 2026-04-23  
**Project:** Performance Evaluation of P.I.T.C.H.  
**Team:** Group 40  
**Status:** Draft for completion against the external IBM Code Engine campaign

## Preamble

This draft consolidates the project proposals, the March 15, 2026 midterm
report, the generated final-report performance scaffolds, and the current IBM
Code Engine plus Grafana Cloud observability direction in the repository. The
report is written as a technical-paper draft rather than a final polished
submission because the primary external-runner dataset is only partially filled
with collected Code Engine results.

Two datasets must remain analytically separate throughout this report:

1. `current-dev-host` This is the already collected development-host dataset
   derived from `perf/results` and summarized in
   `output/doc/pitch_final_report_perf_scaffold_2026-04-23.md`.
2. `final-code-engine-external` This is the intended final dataset for the
   public IBM Code Engine deployment at `https://api.pitchapp.ca`, summarized by
   the scaffold in
   `output/doc/pitch_final_report_perf_code_engine_scaffold_2026-04-23.md`.

That separation is a hard methodological requirement because the TA feedback
identified same-host interference between the load generator and the system
under test as a threat to validity. The final analysis should therefore treat
the co-located development-host measurements as preliminary trend evidence and
the external Code Engine campaign as the primary source for final claims.

## Abstract

P.I.T.C.H. is a microservice-based AI-assisted platform for practicing and
improving presentations and pitches. The system combines a Next.js frontend, a
NestJS API gateway, multiple backend services, asynchronous messaging via
RabbitMQ, Redis caching, and persistent data stores. This project evaluates how
the system behaves as concurrent demand increases, which workloads trigger
performance cliffs, and whether scaling or caching changes improve system
behavior.

The original proposal called for measurement-based load testing with k6, using
response time percentiles, throughput, error rate, and service-level
observability to identify bottlenecks. The midterm phase successfully produced
baseline and light-workload scaling results on a single development machine,
showing a strong low-load response profile, a pronounced tail-latency cliff by
50 to 100 virtual users, instability at 200 virtual users, and collapse behavior
at 500 virtual users. However, because those runs were gathered with the load
generator and the full system co-located on the same host, the midterm dataset
cannot support strong final bottleneck claims by itself.

To address that limitation, the final evaluation direction in this repository
shifts the primary dataset to an IBM Code Engine deployment exercised by an
external k6 runner. The repository now includes a full experiment scaffold for
baseline, light, AI-intensive, mixed, spike, stress, Code Engine application
instance scaling campaigns, along with an observability direction based on
Grafana Cloud OTLP export from the Code Engine application. This draft report
preserves the measured development-host findings, defines the external Code
Engine campaign as the final analytical target, and provides a results scaffold
tied directly to the generated dataset files and expected asset locations.

## 1. Introduction

P.I.T.C.H. is a cloud-native application intended to support pitch rehearsal and
presentation practice through AI-assisted workflows. In the architecture
described by the initial and concrete proposals, requests enter through a
gateway, pass through independently deployable NestJS services, and use shared
infrastructure such as RabbitMQ and Redis while maintaining service-specific
data ownership. This architecture reflects the kinds of modern distributed
systems where performance problems are shaped not only by business logic, but
also by network hops, queueing, concurrency limits, and managed-runtime
behavior.

The project’s three research questions have remained stable across the proposal
and midterm phases:

1. How do response time and throughput change as concurrent user load increases?
2. Which components become the dominant bottlenecks under stress?
3. How do scaling and caching decisions affect latency, throughput, and
   stability?

The final report needs to answer those questions more rigorously than the
midterm report. The midterm data already shows that the light endpoint exhibits
clear non-linear degradation as concurrency rises, but it does not yet isolate
whether the gateway, downstream services, the runtime environment, or same-host
resource interference dominate the observed behavior. The current repository
direction therefore re-centers the study around an external-runner IBM Code
Engine deployment with Grafana Cloud observability and a broader experiment
matrix.

## 2. Background and Related Work

Microservice architectures are widely used because they support modularity,
independent deployment, and elastic scaling. They also create performance
overheads that monolithic systems avoid, including network serialization,
service-to-service coordination, queueing delays, and infrastructure dependence.
For this reason, performance evaluation of microservice systems must observe not
just average latency, but also tail latency, throughput, error rate, and the
state of infrastructure components such as caches, brokers, and databases.

The concrete project proposal grounded this study in prior work comparing
monolithic and microservice deployment patterns in the cloud, especially the
study by Villamizar et al., which highlights the deployment and communication
tradeoffs introduced by distributed services. That framing is appropriate for
P.I.T.C.H. because the application combines synchronous HTTP flows with
asynchronous message-driven work and AI-related operations that are likely to be
more resource-intensive than simple CRUD-style web requests.

Relative to the related work described in the proposal, this project contributes
an applied, reproducible evaluation of a real capstone system rather than a
synthetic benchmark. The workload plan also goes beyond a single HTTP endpoint
by including:

- a light API path: `GET /api/v1/stats/public`
- an AI-intensive path: `POST /api/v1/simulation/scenarios/generate`
- a mixed workload combining both behaviors
- spike and stress experiments
- scaling and cache-state validation experiments

The current observability direction also changes the nature of evidence
available for the final report. Earlier local-environment discussions assumed
Prometheus/Grafana scraping, but the present IBM Code Engine direction uses
Grafana Cloud OTLP/HTTP export directly from the application process. That means
the final report’s service-level attribution should be based on exported HTTP
metrics, traces, logs, Code Engine application metrics, and managed-service
dashboards, rather than assuming a Kubernetes-style per-service scraping setup.

## 3. Methodology

### 3.1 Evaluation Approach

This study uses a quantitative, measurement-based evaluation. Workloads are
generated with k6, and each run exports a JSON summary file for later
aggregation. The experiment families implemented in `perf/k6` reflect the plan
promised in the proposal:

- baseline characterization
- light API load scaling
- AI-intensive load scaling
- mixed workload scaling
- spike testing
- stress testing
- scaling validation
- cache validation, if and only if a real cache-off runtime gate exists

The k6 scaffold uses a closed workload structure and keeps the experiment phases
explicit through warm-up, steady-state, and cool-down windows. According to
`perf/k6/README.md`, the default durations are:

- warm-up: `2m`
- steady-state: `5m`
- cool-down: `1m`

The scripts additionally export steady-state-only custom metrics:

- `steady_http_req_duration`
- `steady_http_req_failed`
- `steady_http_reqs`

These metrics are important because they make the final analysis consistent with
the proposal’s measurement window instead of conflating warm-up and cool-down
traffic with steady-state behavior.

### 3.2 System Under Test

The system under test is P.I.T.C.H., consisting of:

- Next.js frontend
- NestJS API gateway
- backend microservices
- RabbitMQ for asynchronous processing
- Redis for caching
- PostgreSQL and MongoDB persistence

At midterm, the measured system ran as Dockerized services on a single MacBook
Pro development machine. For the final direction, the target system is an IBM
Code Engine application exposed at `https://api.pitchapp.ca`.

An important change in interpretation follows from this deployment shape. The
external scaffold warns that if the Code Engine deployment is a single
application instead of independently deployed services, scaling results should
be interpreted as **application-instance scaling**, not isolated per-service
horizontal scaling. The final paper must preserve that distinction.

### 3.3 Load Generation Topology

The TA feedback states that co-locating the load generator and the system under
test makes it harder to identify real bottlenecks or reflect realistic behavior.
This feedback is already encoded in both scaffold JSON files under
`environment.load_generator_topology.ta_feedback`.

Accordingly, the methodology for the final report is:

- keep the development-host dataset as preliminary evidence only
- treat the external Code Engine campaign as the primary final dataset
- do not merge the two datasets into a single aggregate table
- explicitly discuss remaining public-network and managed-platform variability

### 3.4 Experimental Factors

The concrete proposal specified the following experimental factors:

- concurrent users: `10, 50, 100, 200, 500`
- service replicas or scaled instances: `1, 2, 4`
- cache state: enabled or disabled
- request type: light API, AI-intensive
- workload pattern: constant, spike, stress

The repository’s current Code Engine scaffold translates those factors into the
following experiment matrix:

| Experiment family         | Scenario paths in scaffold                                                        |
| ------------------------- | --------------------------------------------------------------------------------- |
| Baseline characterization | `baseline`                                                                        |
| Light API load scaling    | `light/vus-10`, `light/vus-50`, `light/vus-100`, `light/vus-200`, `light/vus-500` |
| AI-intensive load scaling | `ai/vus-10`, `ai/vus-50`, `ai/vus-100`                                            |
| Mixed workload scaling    | `mixed/vus-10`, `mixed/vus-50`, `mixed/vus-100`                                   |
| Spike and stress          | `spike/light`, `stress/light`                                                     |
| Code Engine scaling       | `scaling/app-instances-1`, `scaling/app-instances-2`, `scaling/app-instances-4`   |

### 3.5 Workload Implementation

The workload scripts are implemented under `perf/k6/scenarios/`:

- `light-public-stats.js`
- `ai-scenario-generate.js`
- `mixed-light-ai.js`
- `spike-light-public-stats.js`
- `stress-light-public-stats.js`
- `replica-scaling-light-public-stats.js`
- `cache-comparison-light-public-stats.js`

For the IBM Code Engine campaign, the matrix runner is
`perf/k6/run_code_engine_matrix.sh`. That script standardizes:

- `BASE_URL=https://api.pitchapp.ca`
- output directories under `perf/results/external`
- repeated-run counts for each experiment family
- scaling-state and cache-state checkpoints

The script also encodes the current interpretation of scaling for the Code
Engine path through:

- `SCALING_TARGET_SERVICE=code-engine-app`
- instance counts `1 2 4`

This is consistent with the scaffold’s warning that the final report should not
overstate per-service scaling claims unless the deployment actually isolates
services at runtime.

### 3.6 Metrics and Observability

The proposal defined the primary metrics as:

- mean latency
- P95 latency
- P99 latency
- throughput
- error rate
- CPU and memory utilization
- RabbitMQ queue depth
- Redis behavior where applicable

The current Grafana Cloud OTLP direction in
`apps/api/docs/observability-grafana-cloud.md` adds the following application
telemetry for the Code Engine deployment:

- `pitch_http_server_requests_total`
- `pitch_http_server_request_duration`
- `pitch_http_server_active_requests`
- one server span per HTTP request
- Nest logs and access logs exported over OTLP

The final observability stack for the Code Engine study should therefore be
described as a layered evidence model:

1. k6 JSON summaries for end-to-end client-visible performance
2. Grafana Cloud OTLP metrics, traces, and logs for application behavior
3. IBM Code Engine application metrics and revision events for runtime behavior
4. RabbitMQ or CloudAMQP dashboards for broker pressure
5. Redis and database dashboards for backend infrastructure pressure

### 3.7 Threats to Validity

This report must keep the following threats explicit.

For the development-host dataset:

- the load generator and all services were co-located
- background machine activity was not fully eliminated
- collapse runs at high load should not be averaged with valid steady-state runs

For the external Code Engine dataset:

- public-network latency can affect end-to-end measurements
- managed-platform scheduling and instance lifecycle behavior can affect timing
- if the deployment is a single Code Engine app, scaling claims are at the app
  level rather than the individual microservice level
- the current application does not expose a verified cache-off toggle, so
  cache-comparison should be treated as future work unless that gate is added

## 4. Results

### 4.1 Dataset Structure for the Final Report

The final report should present results as two separate datasets:

1. **Preliminary development-host dataset** Source:
   `output/doc/pitch_final_report_perf_scaffold_2026-04-23.md`
2. **Primary external Code Engine dataset** Source:
   `output/doc/pitch_final_report_perf_code_engine_scaffold_2026-04-23.md`

The first dataset is already populated. The second now includes smoke-validation
runs for the light and AI workloads and should be filled out as the rest of the
external campaign is executed.

### 4.2 Preliminary Measured Results from the Development-Host Dataset

The currently measured dataset already supports a limited preliminary finding
for the light workload. Table 1 carries forward the aggregated numbers from the
generated scaffold and the midterm report.

| Scenario        | Valid runs | Incomplete runs | Mean latency (ms) | P95 latency (ms) | P99 latency (ms) | Throughput (req/s) | Error rate (%) |
| --------------- | ---------: | --------------: | ----------------: | ---------------: | ---------------: | -----------------: | -------------: |
| baseline        |          2 |               1 |              3.33 |             7.81 |             8.56 |              13.44 |           0.00 |
| light / 10 VUs  |          5 |               0 |              3.41 |             8.35 |            16.90 |              13.43 |           0.00 |
| light / 50 VUs  |          5 |               0 |             82.85 |           229.84 |          2589.82 |              48.95 |           0.00 |
| light / 100 VUs |          4 |               0 |            156.58 |           844.77 |          3999.72 |              87.70 |           0.00 |
| light / 200 VUs |          5 |               0 |           6624.51 |          2390.95 |        310982.23 |             102.40 |          13.79 |
| light / 500 VUs |          2 |               3 |           1060.99 |          4290.31 |         37316.64 |             237.71 |          21.96 |

These results support the following preliminary interpretation:

- low-load behavior is healthy through baseline and 10 VUs
- tail latency increases sharply by 50 VUs
- 100 VUs remains functional but clearly degraded in the tail
- 200 VUs enters instability with substantial error rate
- 500 VUs includes explicit collapse behavior and must be treated carefully

This dataset should remain in the final report as historical evidence of trend
shape, but not as the primary basis for final bottleneck attribution.

### 4.3 Primary Results Scaffold for the IBM Code Engine External Campaign

The main final-report results section should be completed from the generated
Code Engine scaffold:

- markdown source:
  `output/doc/pitch_final_report_perf_code_engine_scaffold_2026-04-23.md`
- JSON source:
  `output/doc/pitch_final_report_perf_code_engine_scaffold_2026-04-23.json`
- dataset definition: `perf/report_datasets/final-code-engine-external.json`
- results root: `perf/results/external`

#### Table 2. Current Code Engine experiment coverage snapshot

This table should keep being refreshed from the scaffold as additional runs are
collected.

| Experiment                               | Planned scenarios | Measured scenarios | Expected runs | Valid runs | Incomplete runs | Status      |
| ---------------------------------------- | ----------------: | -----------------: | ------------: | ---------: | --------------: | ----------- |
| Baseline characterization                |                 1 |                  1 |             2 |          1 |               0 | partial     |
| Light API load scaling                   |                 5 |                  1 |            25 |          1 |               0 | partial     |
| AI-intensive load scaling                |                 3 |                  1 |            15 |          1 |               0 | partial     |
| Mixed workload scaling                   |                 3 |                  1 |            15 |          1 |               0 | partial     |
| Spike and stress testing                 |                 2 |                  0 |             6 |          0 |               0 | not-started |
| Code Engine application instance scaling |                 3 |                  0 |            15 |          0 |               0 | not-started |

#### Table 3. Current Code Engine scenario metrics snapshot

The rows below already include the smoke-validation runs collected against the
live Code Engine deployment.

| Experiment                               | Scenario                  | Valid runs | Incomplete runs | Mean latency (ms, 95% CI) | P95 (ms, 95% CI) | P99 (ms, 95% CI) | Throughput (req/s, 95% CI) | Error rate (%, 95% CI) |
| ---------------------------------------- | ------------------------- | ---------: | --------------: | ------------------------- | ---------------- | ---------------- | -------------------------- | ---------------------- |
| Baseline characterization                | baseline                  |          1 |               0 | 369.19                    | 658.70           | 801.32           | 0.49                       | 0.00                   |
| Light API load scaling                   | light / 10 VUs            |          1 |               0 | 311.96                    | 527.35           | 790.59           | 5.59                       | 0.00                   |
| Light API load scaling                   | light / 50 VUs            |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Light API load scaling                   | light / 100 VUs           |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Light API load scaling                   | light / 200 VUs           |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Light API load scaling                   | light / 500 VUs           |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| AI-intensive load scaling                | AI-intensive / 10 VUs     |          1 |               0 | 6430.14                   | 8466.66          | 8935.18          | 0.98                       | 0.00                   |
| AI-intensive load scaling                | AI-intensive / 50 VUs     |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| AI-intensive load scaling                | AI-intensive / 100 VUs    |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Mixed workload scaling                   | mixed / 10 VUs            |          1 |               0 | 2053.73                   | 6960.24          | 8017.91          | 2.88                       | 0.00                   |
| Mixed workload scaling                   | mixed / 50 VUs            |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Mixed workload scaling                   | mixed / 100 VUs           |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Spike and stress testing                 | spike / light             |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Spike and stress testing                 | stress / light            |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Code Engine application instance scaling | app scaling / 1 instance  |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Code Engine application instance scaling | app scaling / 2 instances |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |
| Code Engine application instance scaling | app scaling / 4 instances |          0 |               0 | n/a                       | n/a              | n/a              | n/a                        | n/a                    |

### 4.4 Figure Placeholders Tied to the Perf Scaffold

The final report should include figures generated from the scaffold pipeline and
stored under the dataset-specific assets directories.

#### Figure placeholder A. Development-host light-workload plots

Use the already generated assets:

- `output/doc/assets/current-dev-host_light-load-scaling_latency.png`
- `output/doc/assets/current-dev-host_light-load-scaling_throughput_error.png`

Suggested caption:

> Light workload latency, throughput, and error behavior for the co-located
> development-host dataset. These figures show trend shape and instability
> thresholds but remain subject to same-host interference.

#### Figure placeholder B. External Code Engine light-workload plots

Expected asset location once generated:

- `output/doc/assets/final-code-engine-external/` or the exact path emitted by
  the report generator for the `final-code-engine-external` dataset

Suggested caption:

> Light workload latency, throughput, and error behavior for the IBM Code Engine
> deployment exercised by an external k6 runner.

#### Figure placeholder C. AI and mixed workload comparison

Expected source scenarios:

- `perf/results/external/ai/vus-*`
- `perf/results/external/mixed/vus-*`

Suggested caption:

> Comparison of low-cost public requests against AI-intensive and mixed
> workloads under increasing concurrency.

#### Figure placeholder D. Stress and spike behavior

Expected source scenarios:

- `perf/results/external/spike/light`
- `perf/results/external/stress/light`

Suggested caption:

> Overload onset and recovery behavior under sudden bursts and progressive
> saturation.

#### Figure placeholder E. Code Engine instance-scaling comparison

Expected source scenarios:

- `perf/results/external/scaling/app-instances-1`
- `perf/results/external/scaling/app-instances-2`
- `perf/results/external/scaling/app-instances-4`

Suggested caption:

> Effect of Code Engine application instance count on light-workload latency and
> throughput.

### 4.5 Observability Correlation Placeholder

This subsection should be completed after the external campaign is run and the
Grafana/Code Engine evidence is collected.

Minimum evidence to insert here:

- Grafana Cloud charts for `pitch_http_server_requests_total`,
  `pitch_http_server_request_duration`, and `pitch_http_server_active_requests`
- trace samples from high-latency windows
- application logs and Code Engine revision events around failures or scale-up
- RabbitMQ or CloudAMQP queue observations during AI and mixed workloads
- Redis and database observations during cache and scaling experiments

Suggested analysis structure:

1. Identify the concurrency region where client-visible latency begins to cliff.
2. Align that region with application metrics and trace timing.
3. Check whether instance changes, revision restarts, or queue growth coincide
   with the client-side degradation.
4. State conclusions cautiously if the Code Engine deployment is still a single
   application rather than isolated microservices.

### 4.6 Missing Evidence Checklist

The following evidence is still missing and must be filled before this draft can
be promoted to a final report:

- external baseline runs
- external light workload runs
- external AI-intensive runs
- external mixed runs
- spike and stress runs
- Code Engine instance-scaling runs
- a real cache-off runtime gate, if cache comparison is still claimed
- Grafana Cloud screenshots or exported panels
- Code Engine scaling configuration used for each campaign
- explicit description of whether the Code Engine deployment is a single app or
  a decomposed multi-service deployment

## 5. Discussion

The current repository state already supports one strong methodological claim:
the final report is better positioned than the midterm report to address the TA
feedback, because it now includes a concrete external-runner evaluation plan and
not just a statement of intent. The presence of
`perf/k6/run_code_engine_matrix.sh`, the external results root under
`perf/results/external`, and the IBM Code Engine scaffold all show that the
final study is designed to separate the load generator from the system under
test.

At the same time, the current evidence base is still incomplete. The
development-host dataset strongly suggests a latency cliff and overload boundary
for the light workload, but it does not yet prove where the bottleneck lies. The
external Code Engine methodology improves the realism of the load topology, yet
it also introduces a different interpretive constraint: managed-platform
behavior and public-network variability become part of the measured end-to-end
system.

As a result, the final report should avoid two common mistakes:

- claiming service-level causality from client-side k6 data alone
- treating Code Engine application-instance scaling as proof of individual
  microservice scaling effects

The most defensible discussion strategy is to present the development-host
dataset as preliminary evidence, treat the external Code Engine campaign as the
primary final dataset, and use Grafana Cloud OTLP plus managed-service evidence
to support cautious bottleneck hypotheses rather than overstated certainty.

## 6. Conclusions and Future Work

This draft final report establishes a clear path from the original proposal to a
defensible final evaluation. The project’s methodological core remains the same:
measurement-based performance evaluation of a microservice-oriented AI system
under varied workloads and concurrency levels. The main difference between the
midterm and final stages is methodological rigor. The repository now explicitly
addresses the earlier same-host limitation by preparing an external k6 campaign
against the IBM Code Engine deployment and by aligning observability with the
current Grafana Cloud OTLP instrumentation path.

Based on the measured development-host data, P.I.T.C.H. already shows a healthy
low-load response profile and a clear degradation threshold under heavier light
workloads. The final report’s main unresolved task is to determine whether those
patterns persist on the externally exercised Code Engine deployment and whether
the broader experiment matrix reveals different behavior for AI-intensive,
mixed, spike, scaling, and cache-validation scenarios.

Future work after the final submission could include:

- decomposing the Code Engine deployment so per-service scaling can be studied
  directly
- instrumenting standalone microservice entrypoints, not only the single Code
  Engine application entrypoint
- extending the analysis to resource cost and cloud-efficiency tradeoffs
- adding statistical significance tests and automated figure generation to the
  final report pipeline
- comparing managed-platform behavior against Kubernetes-based deployment
  behavior under the same k6 scenarios

## References

1. M. Villamizar et al., "Evaluating the monolithic and the microservice
   architecture pattern to deploy web applications in the cloud," 2015 10th
   Computing Colombian Conference (10CCC), Bogota, Colombia, 2015, pp. 583-590,
   doi: 10.1109/ColumbianCC.2015.7333476.
2. `[Placeholder]` IBM Cloud Code Engine documentation page(s) used to justify
   the deployment model, scaling semantics, and runtime metrics for the final
   campaign.
3. `[Placeholder]` Grafana Cloud OpenTelemetry documentation page(s) used to
   justify the OTLP/HTTP observability configuration and exported signal model.
4. `[Placeholder]` k6 documentation page(s) describing closed-workload
   execution, summary export, and scenario configuration.
5. Group 40, _Initial Proposal - Group 40_, repository PDF,
   `docs/Initial Proposal - Group 40.pdf`.
6. Group 40, _Concrete Project Proposal - Group 40_, repository PDF,
   `docs/Concrete Project Proposal - Group 40.pdf`.
7. Group 40, _P.I.T.C.H. Midterm Performance Evaluation Report_, March 15, 2026,
   repository sources: `output/doc/pitch_midterm_report_2026-03-15.md` and
   `docs/pitch_midterm_report_2026-03-15.pdf`.
8. Group 40, _P.I.T.C.H. Final Report Performance Scaffold_, April 23, 2026,
   repository sources:
   `output/doc/pitch_final_report_perf_scaffold_2026-04-23.md` and
   `output/doc/pitch_final_report_perf_scaffold_2026-04-23.json`.
9. Group 40, _P.I.T.C.H. Final Report Performance Scaffold (IBM Code Engine)_,
   April 23, 2026, repository sources:
   `output/doc/pitch_final_report_perf_code_engine_scaffold_2026-04-23.md` and
   `output/doc/pitch_final_report_perf_code_engine_scaffold_2026-04-23.json`.
