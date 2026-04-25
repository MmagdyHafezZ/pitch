#!/usr/bin/env bash
# =============================================================================
# run-production-k8s-campaign.sh
#
# Runs the full k6 experiment matrix against the production k8s deployment and
# writes results to perf/results/production-k8s/ (the final-production-k8s scaffold).
#
# Usage:
#   perf/scripts/run-production-k8s-campaign.sh [groups...]
#
#   Groups match run_k8s_matrix.sh: all | smoke | baseline | light | ai |
#   mixed | spike | stress | scaling | cache
#
#   Default (no args): all
#
# Examples:
#   perf/scripts/run-production-k8s-campaign.sh smoke
#   perf/scripts/run-production-k8s-campaign.sh baseline light
#   perf/scripts/run-production-k8s-campaign.sh            # full matrix
#
# Optional environment variables:
#   ANTHROPIC_API_KEY  — enables AI and mixed workloads
#   OPENAI_API_KEY     — alternative to Anthropic
#   NAMESPACE          — k8s namespace (default: pitch)
#   CLUSTER_NAME       — k3d cluster name (default: pitch-production)
#   DRY_RUN=1          — print commands without executing
#   NON_INTERACTIVE=1  — skip manual checkpoints (required for scaling group)
#   GATEWAY_PORT       — gateway port for port-forward (default: 8000)
#   RESULT_ROOT        — k6 JSON output directory (default: perf/results/production-k8s)
#   KUBE_CONTEXT       — existing production Kubernetes context to use
#   REQUIRE_K3D=1      — require the k3d cluster named by CLUSTER_NAME
# =============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MATRIX_SCRIPT="${ROOT_DIR}/perf/k6/run_k8s_matrix.sh"
NAMESPACE="${NAMESPACE:-pitch}"
CLUSTER_NAME="${CLUSTER_NAME:-pitch-production}"
KUBE_CONTEXT="${KUBE_CONTEXT:-}"
REQUIRE_K3D="${REQUIRE_K3D:-0}"
GATEWAY_PORT="${GATEWAY_PORT:-8000}"
PF_PID_FILE="/tmp/pitch-k8s-pf.pid"

log() { printf '[campaign] %s\n' "$1"; }
die() { printf '[campaign] ERROR: %s\n' "$1" >&2; exit 1; }
ok()  { printf '[campaign] ✓ %s\n' "$1"; }

# -----------------------------------------------------------------------------
# Dependency checks
# -----------------------------------------------------------------------------
command -v k6      >/dev/null 2>&1 || die "k6 not found. Run perf/scripts/setup-production-k8s.sh first."
command -v kubectl >/dev/null 2>&1 || die "kubectl not found."
[[ -x "$MATRIX_SCRIPT" ]] || chmod +x "$MATRIX_SCRIPT"

# -----------------------------------------------------------------------------
# Cluster/context check
# -----------------------------------------------------------------------------
if [[ -n "$KUBE_CONTEXT" ]]; then
  kubectl config use-context "$KUBE_CONTEXT" >/dev/null 2>&1 \
    || die "Cannot switch to KUBE_CONTEXT='${KUBE_CONTEXT}'."
elif command -v k3d >/dev/null 2>&1 && k3d cluster list 2>/dev/null | grep -q "^${CLUSTER_NAME}"; then
  kubectl config use-context "k3d-${CLUSTER_NAME}" >/dev/null 2>&1 \
    || die "Cannot switch to k3d context. Run: k3d kubeconfig merge ${CLUSTER_NAME} --kubeconfig-merge-default"
elif [[ "$REQUIRE_K3D" == "1" ]]; then
  die "k3d cluster '${CLUSTER_NAME}' not found. Run perf/scripts/setup-production-k8s.sh first."
else
  CURRENT_CONTEXT="$(kubectl config current-context 2>/dev/null || true)"
  case "$CURRENT_CONTEXT" in
    docker-desktop|rancher-desktop|minikube|kind-*|k3d-*)
      log "Using current Kubernetes context: ${CURRENT_CONTEXT}"
      ;;
    "")
      die "No kubectl context is selected. Set KUBE_CONTEXT to your production Kubernetes context."
      ;;
    *)
      die "Current kubectl context '${CURRENT_CONTEXT}' was not explicitly selected. Set KUBE_CONTEXT to your production Kubernetes context or use CLUSTER_NAME with k3d."
      ;;
  esac
fi

ACTIVE_CONTEXT="$(kubectl config current-context)"

# Quick readiness check.
NOT_RUNNING=$(kubectl get pods -n "${NAMESPACE}" --no-headers 2>/dev/null \
  | grep -v "Running\|Completed" | wc -l || true)
if [[ "${NOT_RUNNING}" -gt 0 ]]; then
  log "WARNING: ${NOT_RUNNING} pod(s) are not yet Running in namespace '${NAMESPACE}'."
  log "  Run 'kubectl get pods -n ${NAMESPACE}' to diagnose before the campaign."
fi

# -----------------------------------------------------------------------------
# Port-forward management
# -----------------------------------------------------------------------------
stop_port_forward() {
  if [[ -f "$PF_PID_FILE" ]]; then
    local pid
    pid=$(<"$PF_PID_FILE")
    kill "$pid" 2>/dev/null || true
    rm -f "$PF_PID_FILE"
    log "Port-forward stopped (pid ${pid})."
  fi
}
trap stop_port_forward EXIT

start_port_forward() {
  log "Starting kubectl port-forward svc/pitch-gateway ${GATEWAY_PORT}:8000 -n ${NAMESPACE}…"
  kubectl port-forward "svc/pitch-gateway" "${GATEWAY_PORT}:8000" \
    -n "${NAMESPACE}" >/dev/null 2>&1 &
  echo $! >"$PF_PID_FILE"
  # Wait until the port is accepting connections.
  local attempts=0
  while ! curl -sf "http://127.0.0.1:${GATEWAY_PORT}/api/v1/health" >/dev/null 2>&1; do
    (( attempts += 1 ))
    if [[ $attempts -ge 20 ]]; then
      die "Gateway did not respond on 127.0.0.1:${GATEWAY_PORT} after 20 attempts. Check pod logs:\n  kubectl logs deployment/pitch-gateway -n ${NAMESPACE}"
    fi
    sleep 3
  done
  ok "Gateway reachable at http://127.0.0.1:${GATEWAY_PORT}"
}

# Reuse an existing forward if the port is already open.
if curl -sf "http://127.0.0.1:${GATEWAY_PORT}/api/v1/health" >/dev/null 2>&1; then
  ok "Gateway already reachable at http://127.0.0.1:${GATEWAY_PORT}"
else
  start_port_forward
fi

# -----------------------------------------------------------------------------
# Determine which groups to run
# -----------------------------------------------------------------------------
REQUESTED_GROUPS=("${@}")
if [[ ${#REQUESTED_GROUPS[@]} -eq 0 ]]; then
  REQUESTED_GROUPS=("all")
fi

# Check if any AI/mixed work is requested.
NEEDS_AI=0
for g in "${REQUESTED_GROUPS[@]}"; do
  [[ "$g" == "all" || "$g" == "ai" || "$g" == "mixed" ]] && NEEDS_AI=1
done

if [[ "$NEEDS_AI" -eq 1 && -z "${ANTHROPIC_API_KEY:-}" && -z "${OPENAI_API_KEY:-}" ]]; then
  log "WARNING: No ANTHROPIC_API_KEY or OPENAI_API_KEY set."
  log "  AI and mixed workloads will run but scenario generation will fail at the LLM step."
  log "  Set ANTHROPIC_API_KEY=sk-ant-... to enable full AI workloads."
fi

# -----------------------------------------------------------------------------
# Environment — production k8s campaign settings
# -----------------------------------------------------------------------------

# Test durations: compressed for campaign use.
#   Full run: 2m warmup + 5m steady + 1m cooldown = 8 min/run  → ~10 h full matrix
#   Local:    30s warmup + 2m steady + 30s cooldown = 3 min/run → ~3.5 h full matrix
export WARMUP_DURATION="${WARMUP_DURATION:-30s}"
export STEADY_DURATION="${STEADY_DURATION:-2m}"
export COOLDOWN_DURATION="${COOLDOWN_DURATION:-30s}"

# Stress test: cap at 200 VUs (matches the midterm breakdown threshold) and
# shorten step duration so 3 runs fit in a reasonable time.
export MAX_VUS="${MAX_VUS:-200}"
export STEP_VUS="${STEP_VUS:-50}"
export STEP_DURATION="${STEP_DURATION:-1m}"
export INITIAL_RAMP_DURATION="${INITIAL_RAMP_DURATION:-30s}"
export FINAL_HOLD_DURATION="${FINAL_HOLD_DURATION:-30s}"

# Spike: keep defaults (baseline=20, spike=200 VUs).

# Scaling experiment: scale the gateway deployment.
export K8S_SCALE_CMD_TEMPLATE="${K8S_SCALE_CMD_TEMPLATE:-kubectl scale deployment/pitch-gateway -n ${NAMESPACE} --replicas={{value}}}"
export STATE_SETTLE_SEC="${STATE_SETTLE_SEC:-30}"
export SCALING_TARGET_SERVICE="${SCALING_TARGET_SERVICE:-pitch-gateway}"
export INSTANCE_COUNTS="${INSTANCE_COUNTS:-1 2 4}"

# Auth — static bypass token matches DEV_BYPASS_TOKEN in the Helm values.
export PERF_STATIC_AUTH_TOKEN="${PERF_STATIC_AUTH_TOKEN:-pitch-perf-static-token}"
# SCENARIO_ORG_ID must match DEV_BYPASS_USER_ID so the gateway accepts it.
export SCENARIO_ORG_ID="${SCENARIO_ORG_ID:-perf-runner}"

# Target the Kubernetes gateway through the port-forward.
export BASE_URL="http://127.0.0.1:${GATEWAY_PORT}"

# Write results into the production k8s scaffold directory so the report scaffold is filled.
export RESULT_ROOT="${RESULT_ROOT:-${ROOT_DIR}/perf/results/production-k8s}"

# Run counts (match the scaffold expectations).
export BASELINE_RUNS="${BASELINE_RUNS:-2}"
export LIGHT_RUNS="${LIGHT_RUNS:-5}"
export AI_RUNS="${AI_RUNS:-5}"
export MIXED_RUNS="${MIXED_RUNS:-5}"
export SPIKE_RUNS="${SPIKE_RUNS:-3}"
export STRESS_RUNS="${STRESS_RUNS:-3}"
export SCALING_RUNS="${SCALING_RUNS:-5}"

# VU levels (match the scaffold).
export LIGHT_VUS_LIST="${LIGHT_VUS_LIST:-10 50 100 200 500}"
export AI_VUS_LIST="${AI_VUS_LIST:-10 50 100}"
export MIXED_VUS_LIST="${MIXED_VUS_LIST:-10 50 100}"

# Pass through optional dry-run and non-interactive flags.
export DRY_RUN="${DRY_RUN:-0}"
export NON_INTERACTIVE="${NON_INTERACTIVE:-1}"

# Pass AI API keys into the k6 environment if available.
if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
  export ANTHROPIC_API_KEY
fi
if [[ -n "${OPENAI_API_KEY:-}" ]]; then
  export OPENAI_API_KEY
fi

# -----------------------------------------------------------------------------
# Summary banner
# -----------------------------------------------------------------------------
cat <<EOF
[campaign] ================================================================
[campaign]  Production k8s campaign — $(date)
[campaign]
[campaign]  Kube ctx    : ${ACTIVE_CONTEXT}
[campaign]  Namespace   : ${NAMESPACE}
[campaign]  Gateway     : ${BASE_URL}
[campaign]  Results dir : ${RESULT_ROOT}
[campaign]
[campaign]  Run counts  : baseline=${BASELINE_RUNS}, light=${LIGHT_RUNS}, ai=${AI_RUNS}
[campaign]               mixed=${MIXED_RUNS}, spike=${SPIKE_RUNS}, stress=${STRESS_RUNS}
[campaign]               scaling=${SCALING_RUNS}
[campaign]  VU levels   : light=[${LIGHT_VUS_LIST}]
[campaign]               ai=[${AI_VUS_LIST}]  mixed=[${MIXED_VUS_LIST}]
[campaign]
[campaign]  Durations   : warmup=${WARMUP_DURATION}  steady=${STEADY_DURATION}  cooldown=${COOLDOWN_DURATION}
[campaign]  Groups      : ${REQUESTED_GROUPS[*]}
[campaign]  AI key set  : $( [[ -n "${ANTHROPIC_API_KEY:-}${OPENAI_API_KEY:-}" ]] && echo yes || echo no )
[campaign] ================================================================
EOF

if [[ "${DRY_RUN}" == "1" ]]; then
  log "DRY_RUN=1 — commands will be printed but not executed."
fi

# Brief pause so the user can abort if the banner looks wrong.
if [[ "${NON_INTERACTIVE}" != "1" ]]; then
  read -rp "[campaign] Press Enter to start the campaign, or Ctrl-C to abort…"
fi

# -----------------------------------------------------------------------------
# Run
# -----------------------------------------------------------------------------
log "Starting matrix runner…"
"$MATRIX_SCRIPT" "${REQUESTED_GROUPS[@]}"

# -----------------------------------------------------------------------------
# Done
# -----------------------------------------------------------------------------
cat <<EOF

[campaign] ================================================================
[campaign]  Campaign complete — $(date)
[campaign]
[campaign]  Results written to: ${RESULT_ROOT}
[campaign]
[campaign]  Next steps:
[campaign]   1. Verify results:
[campaign]        find ${RESULT_ROOT} -name '*.json' | sort
[campaign]   2. After collecting all data, restore gateway replicas:
[campaign]        kubectl scale deployment/pitch-gateway -n ${NAMESPACE} --replicas=1
[campaign]   3. Generate report plots and tables:
[campaign]        python3 scripts/generate_perf_report.py --config perf/report_datasets/final-production-k8s.json
[campaign] ================================================================
EOF
