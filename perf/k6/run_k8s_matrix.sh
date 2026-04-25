#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
K6_BIN="${K6_BIN:-k6}"
BASE_URL="${BASE_URL:-https://api.pitchapp.ca}"
RESULT_ROOT="${RESULT_ROOT:-${ROOT_DIR}/perf/results/external}"
PERF_STATIC_AUTH_TOKEN="${PERF_STATIC_AUTH_TOKEN:-pitch-perf-static-token}"

BASELINE_RUNS="${BASELINE_RUNS:-2}"
BASELINE_VUS="${BASELINE_VUS:-1}"
LIGHT_RUNS="${LIGHT_RUNS:-5}"
AI_RUNS="${AI_RUNS:-5}"
MIXED_RUNS="${MIXED_RUNS:-5}"
SPIKE_RUNS="${SPIKE_RUNS:-3}"
STRESS_RUNS="${STRESS_RUNS:-3}"
SCALING_RUNS="${SCALING_RUNS:-5}"
CACHE_RUNS="${CACHE_RUNS:-5}"

LIGHT_VUS_LIST="${LIGHT_VUS_LIST:-10 50 100 200 500}"
AI_VUS_LIST="${AI_VUS_LIST:-10 50 100}"
MIXED_VUS_LIST="${MIXED_VUS_LIST:-10 50 100}"
INSTANCE_COUNTS="${INSTANCE_COUNTS:-1 2 4}"
CACHE_STATES="${CACHE_STATES:-enabled disabled}"

SCALING_VUS="${SCALING_VUS:-50}"
CACHE_VUS="${CACHE_VUS:-50}"
CACHE_LAYER="${CACHE_LAYER:-redis}"
SCALING_TARGET_SERVICE="${SCALING_TARGET_SERVICE:-pitch-api}"
LIGHT_WEIGHT="${LIGHT_WEIGHT:-0.7}"
AI_WEIGHT="${AI_WEIGHT:-0.3}"
AI_REQUEST_TIMEOUT="${AI_REQUEST_TIMEOUT:-45s}"
RUN_PAUSE_SEC="${RUN_PAUSE_SEC:-0}"
STATE_SETTLE_SEC="${STATE_SETTLE_SEC:-60}"

DRY_RUN="${DRY_RUN:-0}"
NON_INTERACTIVE="${NON_INTERACTIVE:-0}"

SCENARIO_ORG_ID="${SCENARIO_ORG_ID:-}"
K8S_SCALE_CMD_TEMPLATE="${K8S_SCALE_CMD_TEMPLATE:-}"
CACHE_STATE_CMD_TEMPLATE="${CACHE_STATE_CMD_TEMPLATE:-}"

SCRIPT_LIGHT="${ROOT_DIR}/perf/k6/scenarios/light-public-stats.js"
SCRIPT_AI="${ROOT_DIR}/perf/k6/scenarios/ai-scenario-generate.js"
SCRIPT_MIXED="${ROOT_DIR}/perf/k6/scenarios/mixed-light-ai.js"
SCRIPT_SPIKE="${ROOT_DIR}/perf/k6/scenarios/spike-light-public-stats.js"
SCRIPT_STRESS="${ROOT_DIR}/perf/k6/scenarios/stress-light-public-stats.js"
SCRIPT_SCALING="${ROOT_DIR}/perf/k6/scenarios/replica-scaling-light-public-stats.js"
SCRIPT_CACHE="${ROOT_DIR}/perf/k6/scenarios/cache-comparison-light-public-stats.js"

log() {
  printf '[perf-matrix] %s\n' "$1"
}

die() {
  printf '[perf-matrix] ERROR: %s\n' "$1" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage:
  perf/k6/run_k8s_matrix.sh [all|smoke|baseline|light|ai|mixed|spike|stress|scaling|cache ...]

Defaults:
  - BASE_URL defaults to https://api.pitchapp.ca
  - Results are written under perf/results/external
  - Running with no arguments executes the full matrix

Required for AI and mixed workloads:
  - SCENARIO_ORG_ID
    A personal-workspace run can use the caller's own user id from
    GET /api/v1/auth/me.

Optional automation hooks:
  - K8S_SCALE_CMD_TEMPLATE
    Example:
      K8S_SCALE_CMD_TEMPLATE='kubectl scale deployment/pitch-api --replicas={{value}}'
  - CACHE_STATE_CMD_TEMPLATE
    Example:
      CACHE_STATE_CMD_TEMPLATE='kubectl set env deployment/pitch-api CACHE_ENABLED={{value}}'

Useful environment variables:
  - ACCESS_TOKEN
  - PERF_ACCESS_TOKEN
  - PERF_STATIC_AUTH_TOKEN
  - LIGHT_VUS_LIST
  - AI_VUS_LIST
  - MIXED_VUS_LIST
  - INSTANCE_COUNTS
  - CACHE_STATES
  - DRY_RUN=1
  - NON_INTERACTIVE=1
EOF
}

normalize_base_url() {
  local raw="${1%/}"
  if [[ "$raw" == */api/v1 ]]; then
    log "BASE_URL ended with /api/v1; trimming it because the k6 scenarios append /api/v1 paths internally."
    raw="${raw%/api/v1}"
  fi
  printf '%s' "$raw"
}

split_words() {
  local value="$1"
  local -n out_ref=$2
  read -r -a out_ref <<<"$value"
}

first_non_empty_env() {
  local name
  for name in "$@"; do
    if [[ -n "${!name:-}" ]]; then
      printf '%s' "${!name}"
      return 0
    fi
  done
  return 1
}

infer_workspace_id_from_access_token() {
  local token
  token="$(first_non_empty_env ACCESS_TOKEN PERF_ACCESS_TOKEN PERF_STATIC_AUTH_TOKEN 2>/dev/null || true)"
  [[ -n "$token" ]] || return 1

  python3 - <<'PY' "$token"
import base64
import json
import sys

token = sys.argv[1]
parts = token.split('.')
if len(parts) < 2:
    raise SystemExit(1)

payload = parts[1]
padding = '=' * (-len(payload) % 4)
decoded = base64.urlsafe_b64decode(payload + padding)
data = json.loads(decoded.decode('utf-8'))
sub = data.get('sub', '')
if not sub:
    raise SystemExit(1)
print(sub)
PY
}

append_optional_env() {
  local -n cmd_ref=$1
  shift

  local name
  for name in "$@"; do
    if [[ -n "${!name:-}" ]]; then
      cmd_ref+=("-e" "${name}=${!name}")
    fi
  done
}

run_command() {
  local cmd=("$@")
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '[perf-matrix] DRY RUN:'
    printf ' %q' "${cmd[@]}"
    printf '\n'
    return 0
  fi

  "${cmd[@]}"
}

pause_between_runs() {
  if [[ "$RUN_PAUSE_SEC" =~ ^[0-9]+$ ]] && (( RUN_PAUSE_SEC > 0 )); then
    sleep "$RUN_PAUSE_SEC"
  fi
}

require_org_id() {
  if [[ -z "$SCENARIO_ORG_ID" ]]; then
    SCENARIO_ORG_ID="$(infer_workspace_id_from_access_token 2>/dev/null || true)"
    if [[ -n "$SCENARIO_ORG_ID" ]]; then
      log "SCENARIO_ORG_ID was not set; using JWT subject as personal workspace id: ${SCENARIO_ORG_ID}"
    fi
  fi

  [[ -n "$SCENARIO_ORG_ID" ]] || die "SCENARIO_ORG_ID is required for AI and mixed workloads."
}

run_k6() {
  local output_file=$1
  local scenario_file=$2
  shift 2

  mkdir -p "$(dirname "$output_file")"

  local cmd=(
    "$K6_BIN" run
    --summary-export "$output_file"
    -e "BASE_URL=${BASE_URL}"
    -e "PERF_STATIC_AUTH_TOKEN=${PERF_STATIC_AUTH_TOKEN}"
  )

  append_optional_env cmd \
    WARMUP_DURATION \
    STEADY_DURATION \
    COOLDOWN_DURATION \
    GRACEFUL_RAMP_DOWN \
    THINK_TIME_SEC \
    MORGAN_FORMAT \
    ACCESS_TOKEN \
    PERF_ACCESS_TOKEN \
    SYSTEM_ADMIN_ACCESS_TOKEN \
    REQUEST_TIMEOUT \
    SCENARIO_TYPE \
    SCENARIO_LANGUAGE \
    SCENARIO_TAGS \
    SCENARIO_DURATION_MINUTES \
    SCENARIO_DIFFICULTY \
    SCENARIO_NAME_SEED \
    SCENARIO_OBJECTIVE \
    SCENARIO_CONTEXT \
    SCENARIO_COUNT

  local extra
  for extra in "$@"; do
    cmd+=("-e" "$extra")
  done

  cmd+=("$scenario_file")

  log "Running $(basename "$scenario_file") -> ${output_file#$ROOT_DIR/}"
  # Allow non-zero exit so threshold failures at high load don't abort the campaign.
  run_command "${cmd[@]}" || log "WARNING: k6 exited non-zero for $(basename "$output_file") — thresholds may have been breached; continuing."
  pause_between_runs
}

apply_template_or_confirm() {
  local label=$1
  local value=$2
  local template=$3

  if [[ -n "$template" ]]; then
    local rendered="${template//\{\{value\}\}/$value}"
    log "Applying ${label} using: ${rendered}"
    run_command bash -lc "$rendered"
    if [[ "$STATE_SETTLE_SEC" =~ ^[0-9]+$ ]] && (( STATE_SETTLE_SEC > 0 )); then
      log "Waiting ${STATE_SETTLE_SEC}s for ${label} to settle."
      if [[ "$DRY_RUN" != "1" ]]; then
        sleep "$STATE_SETTLE_SEC"
      fi
    fi
    return 0
  fi

  if [[ "$NON_INTERACTIVE" == "1" || ! -t 0 ]]; then
    die "${label} requires either a template command or an interactive shell confirmation."
  fi

  printf '\n[perf-matrix] Set %s to "%s", then press Enter to continue...' "$label" "$value"
  read -r _
}

run_smoke() {
  require_org_id
  run_k6 \
    "${RESULT_ROOT}/light/vus-10/run-1.json" \
    "$SCRIPT_LIGHT" \
    "VUS=10"
  run_k6 \
    "${RESULT_ROOT}/ai/vus-10/run-1.json" \
    "$SCRIPT_AI" \
    "SCENARIO_ORG_ID=${SCENARIO_ORG_ID}" \
    "VUS=10" \
    "REQUEST_TIMEOUT=${AI_REQUEST_TIMEOUT}"
}

run_baseline() {
  local run
  for run in $(seq 1 "$BASELINE_RUNS"); do
    run_k6 \
      "${RESULT_ROOT}/baseline/run-${run}.json" \
      "$SCRIPT_LIGHT" \
      "VUS=${BASELINE_VUS}"
  done
}

run_light() {
  local vus_values=()
  split_words "$LIGHT_VUS_LIST" vus_values

  local vus run
  for vus in "${vus_values[@]}"; do
    for run in $(seq 1 "$LIGHT_RUNS"); do
      run_k6 \
        "${RESULT_ROOT}/light/vus-${vus}/run-${run}.json" \
        "$SCRIPT_LIGHT" \
        "VUS=${vus}"
    done
  done
}

run_ai() {
  require_org_id
  local vus_values=()
  split_words "$AI_VUS_LIST" vus_values

  local vus run
  for vus in "${vus_values[@]}"; do
    for run in $(seq 1 "$AI_RUNS"); do
      run_k6 \
        "${RESULT_ROOT}/ai/vus-${vus}/run-${run}.json" \
        "$SCRIPT_AI" \
        "SCENARIO_ORG_ID=${SCENARIO_ORG_ID}" \
        "VUS=${vus}" \
        "REQUEST_TIMEOUT=${AI_REQUEST_TIMEOUT}"
    done
  done
}

run_mixed() {
  require_org_id
  local vus_values=()
  split_words "$MIXED_VUS_LIST" vus_values

  local vus run
  for vus in "${vus_values[@]}"; do
    for run in $(seq 1 "$MIXED_RUNS"); do
      run_k6 \
        "${RESULT_ROOT}/mixed/vus-${vus}/run-${run}.json" \
        "$SCRIPT_MIXED" \
        "SCENARIO_ORG_ID=${SCENARIO_ORG_ID}" \
        "VUS=${vus}" \
        "LIGHT_WEIGHT=${LIGHT_WEIGHT}" \
        "AI_WEIGHT=${AI_WEIGHT}" \
        "REQUEST_TIMEOUT=${AI_REQUEST_TIMEOUT}"
    done
  done
}

run_spike() {
  local run
  for run in $(seq 1 "$SPIKE_RUNS"); do
    run_k6 \
      "${RESULT_ROOT}/spike/light/run-${run}.json" \
      "$SCRIPT_SPIKE"
  done
}

run_stress() {
  local run
  for run in $(seq 1 "$STRESS_RUNS"); do
    run_k6 \
      "${RESULT_ROOT}/stress/light/run-${run}.json" \
      "$SCRIPT_STRESS"
  done
}

run_scaling() {
  local instance_values=()
  split_words "$INSTANCE_COUNTS" instance_values

  local count run
  for count in "${instance_values[@]}"; do
    apply_template_or_confirm "Kubernetes pod replicas" "$count" "$K8S_SCALE_CMD_TEMPLATE"
    for run in $(seq 1 "$SCALING_RUNS"); do
      run_k6 \
        "${RESULT_ROOT}/scaling/app-instances-${count}/run-${run}.json" \
        "$SCRIPT_SCALING" \
        "REPLICA_COUNT=${count}" \
        "SCALING_TARGET_SERVICE=${SCALING_TARGET_SERVICE}" \
        "VUS=${SCALING_VUS}"
    done
  done
}

run_cache() {
  log "Cache comparison is only valid if the deployment really changes cache behavior."
  log "The current app does not expose a verified cache-off toggle, so treat this group as experimental."
  local states=()
  split_words "$CACHE_STATES" states

  local state run
  for state in "${states[@]}"; do
    apply_template_or_confirm "cache state" "$state" "$CACHE_STATE_CMD_TEMPLATE"
    for run in $(seq 1 "$CACHE_RUNS"); do
      run_k6 \
        "${RESULT_ROOT}/cache-comparison/${state}/run-${run}.json" \
        "$SCRIPT_CACHE" \
        "CACHE_STATE=${state}" \
        "CACHE_LAYER=${CACHE_LAYER}" \
        "VUS=${CACHE_VUS}"
    done
  done
}

main() {
  command -v "$K6_BIN" >/dev/null 2>&1 || die "k6 binary not found: ${K6_BIN}"

  BASE_URL="$(normalize_base_url "$BASE_URL")"
  mkdir -p "$RESULT_ROOT"

  local groups=("$@")
  if [[ ${#groups[@]} -eq 0 ]]; then
    groups=("all")
  fi

  if [[ "${groups[0]}" == "--help" || "${groups[0]}" == "-h" ]]; then
    usage
    exit 0
  fi

  local group
  for group in "${groups[@]}"; do
    case "$group" in
      all)
        run_baseline
        run_light
        run_ai
        run_mixed
        run_spike
        run_stress
        run_scaling
        run_cache
        ;;
      smoke)
        run_smoke
        ;;
      baseline)
        run_baseline
        ;;
      light)
        run_light
        ;;
      ai)
        run_ai
        ;;
      mixed)
        run_mixed
        ;;
      spike)
        run_spike
        ;;
      stress)
        run_stress
        ;;
      scaling)
        run_scaling
        ;;
      cache)
        run_cache
        ;;
      *)
        die "Unknown group: ${group}. Use --help for usage."
        ;;
    esac
  done

  log "Matrix run complete."
  log "Results root: ${RESULT_ROOT}"
}

main "$@"
