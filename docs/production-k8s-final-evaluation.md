# Production Kubernetes Final Evaluation Runbook

This runbook collects the final production Kubernetes performance dataset and
regenerates the report scaffold used by the final project write-up.

## 1. Select the Kubernetes Cluster

Check your active context before running the campaign:

```bash
kubectl config current-context
kubectl get nodes
```

If the active context is not the intended production Kubernetes context, pass it
explicitly:

```bash
export KUBE_CONTEXT=docker-desktop
# or rancher-desktop, minikube, kind-..., k3d-...
```

The campaign script refuses to run against a unexpected current context unless
`KUBE_CONTEXT` is set.

## 2. Deploy P.I.T.C.H. to Kubernetes

For a fresh k3d-based deployment:

```bash
REBUILD_IMAGE=1 perf/scripts/setup-production-k8s.sh
```

For an already-created production Kubernetes cluster, build and deploy manually:

```bash
docker build -f apps/api/Dockerfile -t pitch-api:production .

helm upgrade --install pitch ./helm/pitch \
  -n pitch --create-namespace \
  -f helm/pitch/values.yaml \
  --set secrets.anthropicApiKey="${ANTHROPIC_API_KEY:-}" \
  --set secrets.openaiApiKey="${OPENAI_API_KEY:-}"

kubectl wait --for=condition=ready pod --all -n pitch --timeout=10m
```

## 3. Run a Smoke Campaign

```bash
perf/scripts/run-production-k8s-campaign.sh smoke
```

This verifies the gateway and the authenticated AI workload path. AI and mixed
workloads require either `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` in the deployed
secret.

## 4. Run the Final Matrix

The default full matrix can take several hours on a laptop.

```bash
perf/scripts/run-production-k8s-campaign.sh
```

For a shorter final dataset, run the key groups first:

```bash
perf/scripts/run-production-k8s-campaign.sh baseline light ai mixed spike stress scaling
```

Results are written under:

```text
perf/results/production-k8s/
```

After scaling runs, restore the gateway to one replica:

```bash
kubectl scale deployment/pitch-gateway -n pitch --replicas=1
```

## 5. Generate the Report Scaffold

```bash
python3 scripts/generate_perf_report.py \
  --config perf/report_datasets/final-production-k8s.json
```

Generated outputs:

```text
output/doc/pitch_final_report_perf_production_k8s_scaffold_2026-04-24.md
output/doc/pitch_final_report_perf_production_k8s_scaffold_2026-04-24.json
output/doc/assets/final-production-k8s/
```

Use the generated tables and charts as the quantitative source for the final
report. State clearly that this is a production Kubernetes evaluation, so the
results support reproducibility and relative scaling conclusions rather than
production capacity claims.
