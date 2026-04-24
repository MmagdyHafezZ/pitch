# PITCH Helm Chart

Helm chart for deploying the PITCH AI-powered business management and simulation
platform on Kubernetes.

## Overview

This chart deploys a complete microservices architecture including:

- **7 Microservices**: Gateway, User, Simulation, Support, Analytics, LTI, S3
- **Infrastructure**: PostgreSQL (6 instances), MongoDB, Redis, RabbitMQ
- **Single Docker Image**: All microservices run from one image with different
  `SERVICE_NAME` env vars
- **Autoscaling**: HPA support for high-traffic services
- **Persistence**: StatefulSets with PVC for databases

## Prerequisites

- Kubernetes 1.24+
- Helm 3.8+
- PV provisioner support (for persistence)
- Ingress controller (if using Ingress)

## Installation

### Quick Start

```bash
# Add required secrets
kubectl create secret generic pitch-secrets \
  --from-literal=postgres-password='your-password' \
  --from-literal=mongodb-root-password='your-password' \
  --from-literal=rabbitmq-password='your-password' \
  --from-literal=jwt-secret='your-jwt-secret-32-chars-minimum'

# Install the chart
helm install pitch ./helm/pitch \
  --namespace pitch \
  --create-namespace \
  --set image.repository=yourorg/pitch-api \
  --set image.tag=latest \
  --set secrets.existingSecret=pitch-secrets
```

### Production Installation

```bash
# Create namespace
kubectl create namespace pitch-production

# Create secrets from file
kubectl create secret generic pitch-secrets \
  --from-env-file=.env.production \
  --namespace pitch-production

# Install with custom values
helm install pitch ./helm/pitch \
  --namespace pitch-production \
  --values values-production.yaml \
  --set image.tag=v1.0.0
```

## Configuration

### Key Configuration Options

| Parameter                          | Description                   | Default             |
| ---------------------------------- | ----------------------------- | ------------------- |
| `image.repository`                 | Docker image repository       | `yourorg/pitch-api` |
| `image.tag`                        | Image tag                     | `latest`            |
| `image.pullPolicy`                 | Image pull policy             | `IfNotPresent`      |
| `secrets.existingSecret`           | Name of existing secret       | `""`                |
| `ingress.enabled`                  | Enable ingress                | `true`              |
| `ingress.className`                | Ingress class                 | `nginx`             |
| `postgresql.*.persistence.enabled` | Enable PostgreSQL persistence | `true`              |
| `postgresql.*.persistence.size`    | PVC size                      | `10Gi`              |

### Microservice Configuration

Each microservice can be configured independently:

```yaml
gateway:
  enabled: true
  replicaCount: 2
  resources:
    limits:
      cpu: 500m
      memory: 512Mi
  autoscaling:
    enabled: false
    minReplicas: 2
    maxReplicas: 10
```

### Database Configuration

```yaml
postgresql:
  user:
    enabled: true
    database: pitch_user
    persistence:
      enabled: true
      size: 10Gi
```

## Architecture

### Single Image Pattern

All microservices use the same Docker image (`pitch-api:latest`):

```yaml
gateway:
  env:
    SERVICE_NAME: gateway # Runs dist/main.js

user:
  env:
    SERVICE_NAME: user # Runs dist/src/microservices/user/main.js
```

This allows:

- ✅ One build, multiple deployments
- ✅ Independent scaling per service
- ✅ Faster CI/CD pipelines
- ✅ Smaller storage footprint

### Database Per Service

Each microservice has its own PostgreSQL database:

- `pitch_user` (User service)
- `pitch_simulation` (Simulation service)
- `pitch_support` (Support service)
- `pitch_analytics` (Analytics service)
- `pitch_lti` (LTI service)
- `pitch_s3` (S3 service)

Plus:

- MongoDB for Simulation service (chat/session data)
- Redis for caching (shared)
- RabbitMQ for messaging (shared)

## Secrets Management

### Required Secrets

The chart requires the following secrets:

```yaml
secrets:
  # Database passwords
  postgresql.auth.password: ''
  mongodb.auth.rootPassword: ''
  rabbitmq.auth.password: ''

  # JWT
  jwtSecret: '' # 32+ characters

  # OAuth (optional)
  googleClientId: ''
  googleClientSecret: ''
  microsoftClientId: ''
  microsoftClientSecret: ''

  # AI APIs (optional)
  openaiApiKey: ''
  anthropicApiKey: ''

  # AWS (optional)
  awsAccessKeyId: ''
  awsSecretAccessKey: ''
```

### Using Existing Secret

```bash
# Create secret manually
kubectl create secret generic my-pitch-secrets \
  --from-literal=postgres-password='...' \
  --from-literal=jwt-secret='...'

# Install chart with existing secret
helm install pitch ./helm/pitch \
  --set secrets.existingSecret=my-pitch-secrets
```

## Scaling

### Horizontal Pod Autoscaling

Enable HPA for specific services:

```yaml
simulation:
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
```

### Manual Scaling

```bash
kubectl scale deployment/pitch-simulation --replicas=5 -n pitch
```

## Persistence

### Enable Persistence

```yaml
postgresql:
  user:
    persistence:
      enabled: true
      size: 20Gi
      storageClass: 'fast-ssd'
```

### Backup

```bash
# Backup PostgreSQL
kubectl exec -it statefulset/pitch-postgres-user -n pitch -- \
  pg_dump -U pitch_user pitch_user > backup.sql

# Backup MongoDB
kubectl exec -it statefulset/pitch-mongodb -n pitch -- \
  mongodump --out=/backup
```

## Monitoring

### View Pod Status

```bash
kubectl get pods -n pitch
```

### View Logs

```bash
# Gateway logs
kubectl logs -f deployment/pitch-gateway -n pitch

# Simulation logs
kubectl logs -f deployment/pitch-simulation -n pitch

# RabbitMQ logs
kubectl logs -f statefulset/pitch-rabbitmq -n pitch
```

### Access RabbitMQ Management UI

```bash
kubectl port-forward svc/pitch-rabbitmq 15672:15672 -n pitch
# Visit http://localhost:15672
```

### Performance Evaluation Profile

Use the dedicated overlay for the final performance-evaluation deployment:

```bash
helm install pitch-perf ./helm/pitch \
  --namespace pitch-perf \
  --create-namespace \
  --values ./helm/pitch/values-perf.yaml \
  --set image.repository=yourorg/pitch-api \
  --set image.tag=latest \
  --set secrets.existingSecret=pitch-secrets
```

This profile makes two deliberate changes for performance testing:

- it disables ingress and exposes the gateway as a `NodePort` so an external k6 runner can target the gateway directly
- it disables autoscaling so replica-count experiments stay under explicit operator control

Retrieve the externally reachable gateway port with:

```bash
kubectl get svc pitch-perf-gateway -n pitch-perf
```

For the final report, run the load generator on a separate machine or node when possible. If the load generator and system under test share the same machine, explicitly document that shared-resource contention can affect latency, throughput, and bottleneck attribution.

The chart currently includes a `ServiceMonitor` for RabbitMQ when `monitoring.enabled=true` and `monitoring.serviceMonitor.enabled=true`, because RabbitMQ is the metrics endpoint already exposed by the chart.

## Upgrading

```bash
# Upgrade to new version
helm upgrade pitch ./helm/pitch \
  --namespace pitch \
  --set image.tag=v1.1.0

# Rollback
helm rollback pitch -n pitch
```

## Uninstalling

```bash
# Delete the release
helm uninstall pitch -n pitch

# Delete PVCs (if you want to remove data)
kubectl delete pvc -l app.kubernetes.io/instance=pitch -n pitch
```

## Troubleshooting

### Pods not starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n pitch

# Check events
kubectl get events -n pitch --sort-by='.lastTimestamp'
```

### Database connection errors

```bash
# Check database pods
kubectl get pods -l app.kubernetes.io/component=postgres-user -n pitch

# Test connection
kubectl exec -it statefulset/pitch-postgres-user -n pitch -- \
  psql -U pitch_user -d pitch_user -c "SELECT 1"
```

### RabbitMQ issues

```bash
# Check RabbitMQ status
kubectl exec -it statefulset/pitch-rabbitmq -n pitch -- \
  rabbitmq-diagnostics status

# List queues
kubectl exec -it statefulset/pitch-rabbitmq -n pitch -- \
  rabbitmqctl list_queues
```

## Development

### Testing Locally

```bash
# Install with minimal resources
helm install pitch ./helm/pitch \
  --namespace pitch-dev \
  --create-namespace \
  --set gateway.resources.limits.cpu=100m \
  --set gateway.resources.limits.memory=128Mi
```

### Linting

```bash
helm lint ./helm/pitch
```

### Template Validation

```bash
helm template pitch ./helm/pitch --debug
```

## License

Copyright © 2024 PITCH Team

## Support

- Documentation: https://docs.pitch.com
- Issues: https://github.com/yourorg/pitch/issues
- Email: support@pitch.com
