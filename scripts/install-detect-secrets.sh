#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
# shellcheck source=/dev/null
. "$REPO_ROOT/scripts/setup-hook-env.sh"

DETECT_SECRETS_CMD=()
DETECT_SECRETS_VERSION="${DETECT_SECRETS_VERSION:-0.13.1+ibm.64.dss}"
DETECT_SECRETS_VENV_ROOT="${DETECT_SECRETS_VENV_ROOT:-${XDG_CACHE_HOME:-$HOME/.cache}/pitch-hooks/detect-secrets}"
DETECT_SECRETS_VENV_BIN="$DETECT_SECRETS_VENV_ROOT/bin/detect-secrets"
DETECT_SECRETS_VENV_PYTHON="$DETECT_SECRETS_VENV_ROOT/bin/python3"
DETECT_SECRETS_VENV_PIP="$DETECT_SECRETS_VENV_ROOT/bin/pip"

resolve_detect_secrets_cmd() {
  if [ -x "$DETECT_SECRETS_VENV_BIN" ] &&
    "$DETECT_SECRETS_VENV_PYTHON" -c "import boxsdk, detect_secrets; from importlib.metadata import version; import sys; sys.exit(0 if version('detect-secrets') == '$DETECT_SECRETS_VERSION' else 1)" >/dev/null 2>&1; then
    DETECT_SECRETS_CMD=("$DETECT_SECRETS_VENV_BIN")
    return 0
  fi

  if command -v detect-secrets >/dev/null 2>&1; then
    DETECT_SECRETS_CMD=(detect-secrets)
    return 0
  fi

  if command -v python3 >/dev/null 2>&1 &&
    python3 -c 'import detect_secrets' >/dev/null 2>&1; then
    DETECT_SECRETS_CMD=(python3 -m detect_secrets.main)
    return 0
  fi

  return 1
}

install_detect_secrets() {
  if ! command -v python3 >/dev/null 2>&1; then
    echo "❌ detect-secrets is missing and python3 is not available." >&2
    exit 127
  fi

  mkdir -p "$(dirname "$DETECT_SECRETS_VENV_ROOT")"
  rm -rf "$DETECT_SECRETS_VENV_ROOT"
  python3 -m venv "$DETECT_SECRETS_VENV_ROOT"
  "$DETECT_SECRETS_VENV_PYTHON" -m pip install --quiet --upgrade pip
  "$DETECT_SECRETS_VENV_PIP" install --quiet --no-input --no-cache-dir \
    "git+https://github.com/IBM/detect-secrets.git@$DETECT_SECRETS_VERSION" \
    'boxsdk<4'

  export PATH="$DETECT_SECRETS_VENV_ROOT/bin:$PATH"
}

ensure_detect_secrets_installed() {
  if resolve_detect_secrets_cmd; then
    return 0
  fi

  echo "Installing detect-secrets $DETECT_SECRETS_VERSION..."
  install_detect_secrets

  resolve_detect_secrets_cmd || {
    echo "❌ detect-secrets installation succeeded but the command is still unavailable." >&2
    exit 127
  }
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  ensure_detect_secrets_installed
  echo "✅ detect-secrets ready at ${DETECT_SECRETS_CMD[0]}"
fi
