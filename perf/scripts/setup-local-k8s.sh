#!/usr/bin/env bash
# =============================================================================
# setup-local-k8s.sh
#
# One-shot setup: install tools → create k3d cluster → build image →
# load image → deploy Helm chart → wait for readiness.
#
# Usage:
#   perf/scripts/setup-local-k8s.sh
#
# Optional environment variables:
#   ANTHROPIC_API_KEY   — required only for AI/mixed k6 workloads
#   OPENAI_API_KEY      — alternative LLM key
#   REBUILD_IMAGE=1     — force a Docker rebuild even if the image exists
#   CLUSTER_NAME        — default: pitch-local
#   NAMESPACE           — default: pitch
# =============================================================================

set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:-pitch-local}"
NAMESPACE="${NAMESPACE:-pitch}"
IMAGE_NAME="pitch-api:local"
CHART_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../helm/pitch" && pwd)"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REBUILD_IMAGE="${REBUILD_IMAGE:-0}"

log()  { printf '[setup] %s\n' "$1"; }
die()  { printf '[setup] ERROR: %s\n' "$1" >&2; exit 1; }
ok()   { printf '[setup] ✓ %s\n' "$1"; }

# -----------------------------------------------------------------------------
# 1. Prerequisites check
# -----------------------------------------------------------------------------
log "Checking prerequisites…"

[[ -f /proc/version ]] && grep -qi microsoft /proc/version && log "Detected WSL2 environment."

command -v docker >/dev/null 2>&1 || die "Docker not found. Install Docker Desktop (WSL2 integration) and retry."
docker info >/dev/null 2>&1     || die "Docker daemon is not running. Start Docker Desktop and retry."
ok "Docker is running."

# k3d
if ! command -v k3d >/dev/null 2>&1; then
  log "k3d not found — installing…"
  curl -fsSL https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash
  ok "k3d installed: $(k3d version | head -1)"
else
  ok "k3d: $(k3d version | head -1)"
fi

# Helm
if ! command -v helm >/dev/null 2>&1; then
  log "Helm not found — installing…"
  curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
  ok "Helm installed: $(helm version --short)"
else
  ok "Helm: $(helm version --short)"
fi

# kubectl (already present, but verify)
command -v kubectl >/dev/null 2>&1 || die "kubectl not found. It should already be installed — check your PATH."
ok "kubectl: $(kubectl version --client --short 2>/dev/null | head -1)"

# k6
if ! command -v k6 >/dev/null 2>&1; then
  log "k6 not found — installing via apt…"
  sudo gpg --no-default-keyring \
    --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
    --keyserver hkp://keyserver.ubuntu.com:80 \
    --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69 2>/dev/null
  echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
    | sudo tee /etc/apt/sources.list.d/k6.list >/dev/null
  sudo apt-get update -qq && sudo apt-get install -y k6 -qq
  ok "k6 installed: $(k6 version)"
else
  ok "k6: $(k6 version)"
fi

# -----------------------------------------------------------------------------
# 2. k3d cluster
# -----------------------------------------------------------------------------
if k3d cluster list 2>/dev/null | grep -q "^${CLUSTER_NAME}"; then
  log "k3d cluster '${CLUSTER_NAME}' already exists — skipping creation."
else
  log "Creating k3d cluster '${CLUSTER_NAME}'…"
  k3d cluster create "${CLUSTER_NAME}" \
    --agents 1 \
    --k3s-arg "--disable=traefik@server:0"
  ok "Cluster created."
fi

# Point kubectl at the local cluster.
k3d kubeconfig merge "${CLUSTER_NAME}" --kubeconfig-merge-default >/dev/null
kubectl config use-context "k3d-${CLUSTER_NAME}" >/dev/null
ok "kubectl context → k3d-${CLUSTER_NAME}"

# -----------------------------------------------------------------------------
# 3. Build Docker image
# -----------------------------------------------------------------------------
if [[ "$REBUILD_IMAGE" == "1" ]] || ! docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
  log "Building Docker image '${IMAGE_NAME}' (this takes a few minutes)…"
  docker build \
    --file "${ROOT_DIR}/apps/api/Dockerfile" \
    --tag "${IMAGE_NAME}" \
    "${ROOT_DIR}"
  ok "Image built: ${IMAGE_NAME}"
else
  log "Image '${IMAGE_NAME}' already exists — skipping build (set REBUILD_IMAGE=1 to force)."
fi

# -----------------------------------------------------------------------------
# 4. Load image into cluster
# -----------------------------------------------------------------------------
log "Loading image into k3d cluster…"
k3d image import "${IMAGE_NAME}" --cluster "${CLUSTER_NAME}"
ok "Image loaded into cluster."

# -----------------------------------------------------------------------------
# 5. Namespace
# -----------------------------------------------------------------------------
if ! kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1; then
  kubectl create namespace "${NAMESPACE}"
  ok "Namespace '${NAMESPACE}' created."
else
  log "Namespace '${NAMESPACE}' already exists."
fi

# -----------------------------------------------------------------------------
# 6. Helm deploy
# -----------------------------------------------------------------------------
log "Deploying Helm chart…"

HELM_SET_ARGS=(
  "--set" "secrets.anthropicApiKey=${ANTHROPIC_API_KEY:-}"
  "--set" "secrets.openaiApiKey=${OPENAI_API_KEY:-}"
)

HELM_CMD="upgrade --install"

if helm status pitch -n "${NAMESPACE}" >/dev/null 2>&1; then
  log "Release 'pitch' already exists — upgrading."
else
  log "Installing release 'pitch'."
fi

helm upgrade --install pitch "${CHART_DIR}" \
  --namespace "${NAMESPACE}" \
  --values "${CHART_DIR}/values-local.yaml" \
  "${HELM_SET_ARGS[@]}" \
  --timeout 5m \
  --wait=false

ok "Helm release deployed."

# -----------------------------------------------------------------------------
# 7. Wait for readiness
# -----------------------------------------------------------------------------
log "Waiting for all pods to become ready (up to 10 minutes)…"
log "  (Pods initialising — databases start first, then microservices)"

# Give the scheduler a moment before polling.
sleep 5

DEADLINE=$(( $(date +%s) + 600 ))
while true; do
  NOT_READY=$(kubectl get pods -n "${NAMESPACE}" \
    --no-headers 2>/dev/null \
    | grep -v "^$" \
    | grep -Ev "Running|Completed" \
    | grep -v "1/1\|2/2\|3/3" \
    | wc -l || true)

  TOTAL=$(kubectl get pods -n "${NAMESPACE}" --no-headers 2>/dev/null | grep -c "." || true)
  READY=$(kubectl get pods -n "${NAMESPACE}" --no-headers 2>/dev/null | grep -c "Running" || true)

  log "  Pods: ${READY}/${TOTAL} running…"

  if [[ "$TOTAL" -gt 0 && "$NOT_READY" -eq 0 ]]; then
    break
  fi

  if [[ $(date +%s) -ge $DEADLINE ]]; then
    log "Timeout waiting for pods. Current state:"
    kubectl get pods -n "${NAMESPACE}"
    die "Not all pods became ready in time. Run 'kubectl describe pod <name> -n ${NAMESPACE}' to diagnose."
  fi

  sleep 15
done

ok "All pods ready."
kubectl get pods -n "${NAMESPACE}"

# -----------------------------------------------------------------------------
# 8. Verify gateway health
# -----------------------------------------------------------------------------
log "Verifying gateway health via temporary port-forward…"
kubectl port-forward "svc/pitch-gateway" 18999:8000 -n "${NAMESPACE}" >/dev/null 2>&1 &
PF_PID=$!
sleep 3

if curl -sf http://localhost:18999/health >/dev/null 2>&1; then
  ok "Gateway health check passed."
else
  log "WARNING: Gateway health check did not return 200. The gateway may still be starting."
  log "  Check: kubectl logs deployment/pitch-gateway -n ${NAMESPACE}"
fi

kill "$PF_PID" 2>/dev/null || true

# -----------------------------------------------------------------------------
# Done
# -----------------------------------------------------------------------------
cat <<EOF

[setup] ================================================================
[setup]  Setup complete.
[setup]
[setup]  Cluster : k3d-${CLUSTER_NAME}
[setup]  Namespace: ${NAMESPACE}
[setup]  Image   : ${IMAGE_NAME}
[setup]
[setup]  Next step — run the performance campaign:
[setup]    perf/scripts/run-local-campaign.sh
[setup]
[setup]  Or run a quick smoke test first:
[setup]    perf/scripts/run-local-campaign.sh smoke
[setup] ================================================================
EOF
