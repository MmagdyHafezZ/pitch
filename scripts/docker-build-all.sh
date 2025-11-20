#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKERFILE="${ROOT_DIR}/apps/api/Dockerfile"
IMAGE_PREFIX="pitch"
MAX_PARALLEL_BUILDS="${MAX_PARALLEL_BUILDS:-4}"

if command -v tput >/dev/null && [ -t 1 ]; then
  COLOR_INFO="$(tput setaf 6)"
  COLOR_SUCCESS="$(tput setaf 2)"
  COLOR_WARN="$(tput setaf 3)"
  COLOR_ERROR="$(tput setaf 1)"
  COLOR_RESET="$(tput sgr0)"
else
  COLOR_INFO=""
  COLOR_SUCCESS=""
  COLOR_WARN=""
  COLOR_ERROR=""
  COLOR_RESET=""
fi

log_info() {
  printf "%s➤ %s%s\n" "${COLOR_INFO}" "$1" "${COLOR_RESET}"
}

log_success() {
  printf "%s✓ %s%s\n" "${COLOR_SUCCESS}" "$1" "${COLOR_RESET}"
}

log_warn() {
  printf "%s⚠ %s%s\n" "${COLOR_WARN}" "$1" "${COLOR_RESET}"
}

log_error() {
  printf "%s✗ %s%s\n" "${COLOR_ERROR}" "$1" "${COLOR_RESET}"
}

SERVICES=(
  gateway
  user
  simulation
  support
  analytics
  lti
  s3
  crm
)

# Allow filtering services via CLI args
if [ "$#" -gt 0 ]; then
  SERVICES=("$@")
fi

if [ "${#SERVICES[@]}" -eq 0 ]; then
  log_warn "No services specified. Nothing to build."
  exit 0
fi

declare -A BUILD_STATUS

build_service() {
  local service="$1"
  local tag="${IMAGE_PREFIX}-${service}:latest"
  local start_ts
  start_ts=$(date +%s)

  log_info "[${service}] Starting build -> ${tag}"

  if docker build \
    -f "${DOCKERFILE}" \
    --build-arg "SERVICE_NAME=${service}" \
    -t "${tag}" \
    "${ROOT_DIR}" \
    > >(sed "s/^/[${service}] /") \
    2> >(sed "s/^/[${service}] /" >&2); then
    local duration=$(( $(date +%s) - start_ts ))
    log_success "[${service}] Completed in ${duration}s -> ${tag}"
    BUILD_STATUS["${service}"]="success"
  else
    local duration=$(( $(date +%s) - start_ts ))
    log_error "[${service}] Failed after ${duration}s"
    BUILD_STATUS["${service}"]="failed"
    return 1
  fi
}

running=0
failures=0

log_info "Building ${#SERVICES[@]} images (parallel limit: ${MAX_PARALLEL_BUILDS})"

for service in "${SERVICES[@]}"; do
  build_service "${service}" &
  running=$((running + 1))

  if (( running >= MAX_PARALLEL_BUILDS )); then
    if ! wait -n; then
      failures=$((failures + 1))
    fi
    running=$((running - 1))
  fi
done

while (( running > 0 )); do
  if ! wait -n; then
    failures=$((failures + 1))
  fi
  running=$((running - 1))
done

echo ""
log_info "Build summary:"
for service in "${SERVICES[@]}"; do
  status="${BUILD_STATUS[$service]:-failed}"
  if [ "${status}" = "success" ]; then
    log_success "  • ${service}"
  else
    log_error "  • ${service}"
  fi
done

if (( failures > 0 )); then
  log_error "Completed with ${failures} failure(s)."
  exit 1
fi

log_success "All ${#SERVICES[@]} images built successfully 🚀"
