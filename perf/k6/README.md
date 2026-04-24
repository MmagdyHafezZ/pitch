# k6 Performance Scenarios

This directory adds a reusable benchmark scaffold for the final project
delivery. It is designed around the experiment plan in the original proposal:

- run load generation from a separate host when possible
- keep a warm-up, steady-state, and cool-down structure
- preserve JSON summaries under `perf/results`
- cover light, AI, mixed, spike, stress, and scaling workloads

## Scenarios

- `scenarios/light-public-stats.js`
  - Hits `GET /api/v1/stats/public` on the gateway
  - Intended as the light, public, low-cost request path
- `scenarios/ai-scenario-generate.js`
  - Hits `POST /api/v1/simulation/scenarios/generate` through the gateway
  - Recommended AI-intensive path for the final external campaign
- `scenarios/ai-llm-test.js`
  - Hits `POST /simulation/llm/test` on the simulation HTTP service
  - Useful for direct simulation-service testing when that service is exposed
    and system-admin auth is available
- `scenarios/mixed-light-ai.js`
  - Randomly mixes the light public stats endpoint with AI scenario generation
- `scenarios/spike-light-public-stats.js`
  - Uses a spike profile against the light endpoint
- `scenarios/stress-light-public-stats.js`
  - Gradually ramps until the light endpoint reaches saturation
- `scenarios/replica-scaling-light-public-stats.js`
  - Reuses the light workload while tagging a specific replica-count experiment
- `scenarios/cache-comparison-light-public-stats.js`
  - Reuses the light workload while tagging a specific cache-state experiment

Both scripts emit the normal k6 HTTP metrics and also emit steady-state-only
custom metrics:

- `steady_http_req_duration`
- `steady_http_req_failed`
- `steady_http_reqs`

Those metrics let the final analysis focus on the proposal’s 5-minute
measurement window instead of mixing warm-up and cool-down traffic into the same
aggregates.

## External Runner Usage

Run these from a machine that is separate from the system under test whenever
possible. That directly addresses the TA feedback about same-host interference.

### Full matrix runner

For the IBM Code Engine final campaign, you can run the whole planned matrix
with:

```bash
SCENARIO_ORG_ID=org_123 \
BASE_URL=https://api.pitchapp.ca \
perf/k6/run_code_engine_matrix.sh all
```

Important:

- Use `BASE_URL=https://api.pitchapp.ca`, not `/api/v1`, because the workload
  scripts append `/api/v1/...` internally.
- The `scaling` and `cache` groups may require deployment-state changes between
  runs. The script supports either:
  - interactive checkpoints, or
  - command templates via `CODE_ENGINE_SCALE_CMD_TEMPLATE` and
    `CACHE_STATE_CMD_TEMPLATE`
- For authenticated Code Engine runs, prefer a real JWT in `ACCESS_TOKEN` or
  `PERF_ACCESS_TOKEN`. Keep `PERF_STATIC_AUTH_TOKEN` for a dedicated perf
  deployment that explicitly enables the bypass token.
- `SCENARIO_ORG_ID` can be your own user id for a personal-workspace run.
- If you want a team-scoped run instead, use a team id from
  `GET /api/v1/teams/user-teams`.
- If `SCENARIO_ORG_ID` is omitted and `ACCESS_TOKEN` is set, the matrix runner
  now falls back to the JWT `sub` claim automatically.

Examples:

```bash
perf/k6/run_code_engine_matrix.sh smoke
perf/k6/run_code_engine_matrix.sh light ai mixed
NON_INTERACTIVE=1 DRY_RUN=1 SCENARIO_ORG_ID=org_123 perf/k6/run_code_engine_matrix.sh all
```

### Light workload

```bash
k6 run \
  --summary-export perf/results/external/light/vus-50/run-1.json \
  -e BASE_URL=http://your-gateway-host:8000 \
  -e VUS=50 \
  perf/k6/scenarios/light-public-stats.js
```

### AI-intensive workload through the gateway

```bash
k6 run \
  --summary-export perf/results/external/ai/vus-10/run-1.json \
  -e BASE_URL=https://api.pitchapp.ca \
  -e ACCESS_TOKEN="$ACCESS_TOKEN" \
  -e SCENARIO_ORG_ID="$USER_ID_FROM_AUTH_ME" \
  -e VUS=10 \
  -e REQUEST_TIMEOUT=45s \
  perf/k6/scenarios/ai-scenario-generate.js
```

### Mixed workload

```bash
k6 run \
  --summary-export perf/results/external/mixed/vus-50/run-1.json \
  -e BASE_URL=https://api.pitchapp.ca \
  -e ACCESS_TOKEN="$ACCESS_TOKEN" \
  -e SCENARIO_ORG_ID="$USER_ID_FROM_AUTH_ME" \
  -e VUS=50 \
  -e LIGHT_WEIGHT=0.7 \
  -e AI_WEIGHT=0.3 \
  perf/k6/scenarios/mixed-light-ai.js
```

### Spike workload

```bash
k6 run \
  --summary-export perf/results/external/spike/light/run-1.json \
  -e BASE_URL=http://your-gateway-host:8000 \
  -e BASELINE_VUS=20 \
  -e SPIKE_VUS=200 \
  perf/k6/scenarios/spike-light-public-stats.js
```

### Stress workload

```bash
k6 run \
  --summary-export perf/results/external/stress/light/run-1.json \
  -e BASE_URL=http://your-gateway-host:8000 \
  -e START_VUS=10 \
  -e STEP_VUS=50 \
  -e MAX_VUS=500 \
  perf/k6/scenarios/stress-light-public-stats.js
```

### Replica-scaling validation

Run the same script once per deployment shape.

```bash
k6 run \
  --summary-export perf/results/external/scaling/gateway-replicas-2/run-1.json \
  -e BASE_URL=http://your-gateway-host:8000 \
  -e REPLICA_COUNT=2 \
  -e SCALING_TARGET_SERVICE=gateway \
  -e VUS=50 \
  perf/k6/scenarios/replica-scaling-light-public-stats.js
```

### Cache comparison

Run once against the cache-enabled deployment and once against the
cache-disabled deployment.

```bash
k6 run \
  --summary-export perf/results/external/cache-comparison/enabled/run-1.json \
  -e BASE_URL=http://your-gateway-host:8000 \
  -e CACHE_STATE=enabled \
  -e CACHE_LAYER=redis \
  -e VUS=50 \
  perf/k6/scenarios/cache-comparison-light-public-stats.js
```

This comparison is still experimental in the current repo. The workload script
only tags requests with `CACHE_STATE`, and the application does not currently
expose a verified cache-off deployment toggle. Do not report cache-comparison
results in the final paper unless the runtime behavior actually changed between
the enabled and disabled runs.

## Supported Environment Variables

- `VUS`
  - Target concurrent virtual users
- `WARMUP_DURATION`
  - Default `2m`
- `STEADY_DURATION`
  - Default `5m`
- `COOLDOWN_DURATION`
  - Default `1m`
- `GRACEFUL_RAMP_DOWN`
  - Default `30s`
- `THINK_TIME_SEC`
  - Per-iteration sleep after each request

Light scenario:

- `BASE_URL`
  - Default `http://localhost:8000`

Static auth:

- `ACCESS_TOKEN`
  - Preferred for a real-user Code Engine run
- `PERF_ACCESS_TOKEN`
  - Alias for `ACCESS_TOKEN`
- `PERF_STATIC_AUTH_TOKEN`
  - Static bearer token used by all authenticated k6 scripts
  - Default `pitch-perf-static-token`
  - This must match the gateway perf deployment’s `DEV_BYPASS_TOKEN`

AI scenario generation:

- `SCENARIO_ORG_ID`
  - Required org/workspace ID for `POST /api/v1/simulation/scenarios/generate`
  - For real-user benchmarking, this can be the caller's own user id from
    `GET /api/v1/auth/me`
  - For a team-scoped run, use a team id from `GET /api/v1/teams/user-teams`
- `SCENARIO_TYPE`
  - Default `text`
- `SCENARIO_LANGUAGE`
  - Default `en-US`
- `SCENARIO_TAGS`
  - CSV string, default `sales,onboarding`
- `SCENARIO_DURATION_MINUTES`
  - Default `30`
- `SCENARIO_DIFFICULTY`
  - Default `6`
- `SCENARIO_NAME_SEED`
  - Optional scenario title seed
- `SCENARIO_OBJECTIVE`
  - Optional objective override
- `SCENARIO_CONTEXT`
  - Optional context override
- `SCENARIO_COUNT`
  - Optional batch size; values greater than `1` use `/generate/batch`

Direct simulation LLM test:

- `SIMULATION_BASE_URL`
  - Default `http://localhost:3001`
- `AI_PROMPT`
  - Custom prompt body for the LLM test endpoint
- `REQUEST_TIMEOUT`
  - Default `70s` for `ai-llm-test.js`, `45s` for scenario generation

Mixed workload:

- `LIGHT_WEIGHT`
  - Default `0.7`
- `AI_WEIGHT`
  - Default `0.3`

Spike workload:

- `BASELINE_VUS`
  - Default `20`
- `SPIKE_VUS`
  - Default `200`
- `BASELINE_HOLD_DURATION`
  - Default `1m`
- `SPIKE_RAMP_DURATION`
  - Default `10s`
- `SPIKE_HOLD_DURATION`
  - Default `30s`
- `RECOVERY_RAMP_DURATION`
  - Default `10s`
- `RECOVERY_HOLD_DURATION`
  - Default `1m`

Stress workload:

- `START_VUS`
  - Default `10`
- `STEP_VUS`
  - Default `50`
- `MAX_VUS`
  - Default `500`
- `INITIAL_RAMP_DURATION`
  - Default `30s`
- `STEP_DURATION`
  - Default `2m`
- `FINAL_HOLD_DURATION`
  - Default `1m`

Replica-scaling validation:

- `SCALING_TARGET_SERVICE`
  - Default `gateway`
- `REPLICA_COUNT`
  - Default `1`

Cache comparison:

- `CACHE_STATE`
  - Default `enabled`
- `CACHE_LAYER`
  - Default `redis`

## Suggested Final Experiment Matrix

- Light load scaling: `10, 50, 100, 200, 500` VUs
- AI load scaling: `10, 50, 100` VUs through `ai-scenario-generate.js`
- Mixed load scaling: `10, 50, 100` VUs through `mixed-light-ai.js`
- Spike testing: at least `3` repeated runs with `spike-light-public-stats.js`
- Stress testing: at least `3` repeated runs with `stress-light-public-stats.js`
- Replica scaling: repeat `replica-scaling-light-public-stats.js` at replica
  counts `1, 2, 4`
- Cache comparison: only include this if you have a real cache-on and cache-off
  deployment/runtime toggle
- Repeat each configuration 5 times
- Store each run under a stable subtree, for example:
  - `perf/results/external/light/vus-50/run-1.json`
  - `perf/results/external/ai/vus-10/run-1.json`
  - `perf/results/external/mixed/vus-50/run-1.json`
  - `perf/results/external/spike/light/run-1.json`
  - `perf/results/external/stress/light/run-1.json`
  - `perf/results/external/scaling/gateway-replicas-2/run-1.json`
  - `perf/results/external/cache-comparison/enabled/run-1.json`

## If Separate Hosts Are Not Feasible

Run k6 in a dedicated container or runner with fixed CPU and memory limits, keep
other foreground work off the machine, and state the limitation explicitly in
the final report. Use those runs for trend and bottleneck ranking rather than
claiming fully isolated hardware measurements.

## Auth Options

Preferred Code Engine path:

- use a real JWT in `ACCESS_TOKEN`
- use your own user id from `GET /api/v1/auth/me` as `SCENARIO_ORG_ID` for a
  personal-workspace run

Optional perf-deployment path:

- use the static bypass token in `PERF_STATIC_AUTH_TOKEN`
- use `DEV_BYPASS_USER_ID` as `SCENARIO_ORG_ID`

If you deploy a dedicated perf environment with the bypass token, the gateway
must be deployed with matching env vars:

```env
DEV_BYPASS_ENABLED=true
DEV_BYPASS_TOKEN=pitch-perf-static-token
DEV_BYPASS_EMAIL=dev@local
DEV_BYPASS_NAME=Performance Runner
DEV_BYPASS_USER_ID=perf-runner
```

When `DEV_BYPASS_ENABLED=true`, the gateway accepts
`Authorization: Bearer pitch-perf-static-token` and attaches the configured
bypass user. Because the bypass email is also treated as a system admin, the
same token can exercise normal authenticated routes and system-admin-protected
routes.
