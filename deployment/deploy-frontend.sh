#!/bin/bash
set -e

echo "==> Targeting project..."
ibmcloud target -g "Magdy Hafez Capstone Project"
ibmcloud ce project select --name "pitch-main"

# ── Frontend ─────────────────────────────────────────────────────────────────
FRONTEND=pitch-frontend-main
echo "==> Deploying $FRONTEND..."

if ibmcloud ce application get --name "$FRONTEND" &>/dev/null; then
  ibmcloud ce application update \
    --name "$FRONTEND" \
    --build-source git@github.com:MmagdyHafezZ/pitch.git \
    --build-commit main \
    --build-strategy dockerfile \
    --build-dockerfile apps/web/Dockerfile \
    --build-git-repo-secret pitch-github-ssh-ym \
    --build-timeout 1200 \
    --build-size medium \
    --image ghcr.io/ymamoun/pitch-frontend:main \
    --registry-secret github-pat-ym-2 \
    --min-scale 1 \
    --rebuild \
    --wait
else
  ibmcloud ce application create \
    --name "$FRONTEND" \
    --build-source git@github.com:MmagdyHafezZ/pitch.git \
    --build-commit main \
    --build-strategy dockerfile \
    --build-dockerfile apps/web/Dockerfile \
    --build-git-repo-secret pitch-github-ssh-ym \
    --build-timeout 1200 \
    --build-size medium \
    --image ghcr.io/ymamoun/pitch-frontend:main \
    --registry-secret github-pat-ym-2 \
    --min-scale 1 \
    --scale-down-delay 900 \
    --wait
fi

# ── Domain mapping ────────────────────────────────────────────────────────────
echo "==> Configuring domain mapping..."

if ibmcloud ce domainmapping get --domain-name pitchapp.ca &>/dev/null; then
  echo "    Domain pitchapp.ca already mapped, skipping."
else
  ibmcloud ce domainmapping create \
    --domain-name pitchapp.ca \
    --target "$FRONTEND" \
    --target-type application \
    --tls-secret pitchapp-tls
fi

echo "==> Done. Frontend deployed from branch 'main'."
