# Helm Chart Setup Guide

## Overview

Complete Helm chart for deploying the PITCH microservices platform on
Kubernetes.

## Files Created

```
helm/pitch/
├── Chart.yaml                           # Chart metadata
├── values.yaml                          # Default configuration values
├── README.md                            # Chart documentation
├── .helmignore                          # Files to exclude from chart
└── templates/
    ├── _helpers.tpl                     # Template helpers and functions
    ├── NOTES.txt                        # Post-installation notes
    ├── configmap.yaml                   # ConfigMap for app configuration
    ├── secret.yaml                      # Secrets management
    ├── serviceaccount.yaml              # Kubernetes ServiceAccount
    ├── ingress.yaml                     # Ingress for external access
    ├── hpa.yaml                         # HorizontalPodAutoscaler
    ├── services.yaml                    # Services for all microservices
    ├── deployment-gateway.yaml          # Gateway deployment
    ├── deployment-user.yaml             # User service deployment
    ├── deployment-simulation.yaml       # Simulation service deployment
    ├── deployments-remaining.yaml       # Support, Analytics, LTI, S3 deployments
    ├── statefulset-postgres.yaml        # PostgreSQL StatefulSets (6 instances)
    ├── statefulset-mongodb.yaml         # MongoDB StatefulSet
    ├── statefulset-redis.yaml           # Redis StatefulSet
    └── statefulset-rabbitmq.yaml        # RabbitMQ StatefulSet
```

## Chart Architecture

### Single-Image Pattern ✅

All microservices use the same Docker image with different `SERVICE_NAME`
environment variables:

```yaml
# Gateway
env:
  SERVICE_NAME: gateway  # Runs dist/main.js

# User Service
env:
  SERVICE_NAME: user     # Runs dist/src/microservices/user/main.js
```

### Components Deployed

**Microservices (7)**:

- API Gateway (Port 8000)
- User Service (Port 3001)
- Simulation Service (Port 3002)
- Support Service (Port 3003)
- Analytics Service (Port 3004)
- LTI Service (Port 3005)
- S3 Service (Port 3006)

**Infrastructure**:

- PostgreSQL × 6 (one per microservice)
- MongoDB × 1 (for Simulation chat/session data)
- Redis × 1 (shared cache)
- RabbitMQ × 1 (message broker)

## Quick Start

### 1. Prerequisites

```bash
# Verify Helm is installed
helm version

# Verify kubectl is configured
kubectl cluster-info

# Create namespace
kubectl create namespace pitch
```

### 2. Create Secrets

```bash
# Create secrets from environment variables
kubectl create secret generic pitch-secrets \
  --from-literal=postgres-password='your-strong-password' \
  --from-literal=mongodb-root-password='your-strong-password' \
  --from-literal=rabbitmq-password='your-strong-password' \
  --from-literal=jwt-secret='your-jwt-secret-at-least-32-characters' \
  --from-literal=openai-api-key='sk-...' \
  --from-literal=anthropic-api-key='sk-ant-...' \
  --namespace pitch
```

### 3. Install Chart

```bash
# Install with default values
helm install pitch ./helm/pitch \
  --namespace pitch \
  --set image.repository=yourorg/pitch-api \
  --set image.tag=latest \
  --set secrets.existingSecret=pitch-secrets

# Or with custom values file
helm install pitch ./helm/pitch \
  --namespace pitch \
  --values values-production.yaml
```

### 4. Verify Deployment

```bash
# Check pod status
kubectl get pods -n pitch

# Check services
kubectl get svc -n pitch

# View installation notes
helm get notes pitch -n pitch
```

## Configuration Examples

### Production values.yaml

```yaml
# values-production.yaml

image:
  repository: registry.yourcompany.com/pitch-api
  tag: 'v1.0.0'
  pullPolicy: Always

global:
  storageClass: 'fast-ssd'

# Enable autoscaling for high-traffic services
gateway:
  replicaCount: 3
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
  resources:
    limits:
      cpu: 1000m
      memory: 1Gi
    requests:
      cpu: 500m
      memory: 512Mi

simulation:
  replicaCount: 5
  autoscaling:
    enabled: true
    minReplicas: 5
    maxReplicas: 20
    targetCPUUtilizationPercentage: 70
  resources:
    limits:
      cpu: 2000m
      memory: 2Gi
    requests:
      cpu: 1000m
      memory: 1Gi

# Ingress with TLS
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: 'letsencrypt-prod'
    nginx.ingress.kubernetes.io/ssl-redirect: 'true'
    nginx.ingress.kubernetes.io/rate-limit: '100'
  hosts:
    - host: api.pitch.com
      paths:
        - path: /
          pathType: Prefix
          service: gateway
  tls:
    - secretName: pitch-api-tls
      hosts:
        - api.pitch.com

# Database persistence
postgresql:
  user:
    persistence:
      enabled: true
      size: 50Gi
  simulation:
    persistence:
      enabled: true
      size: 100Gi
  analytics:
    persistence:
      enabled: true
      size: 200Gi

mongodb:
  persistence:
    enabled: true
    size: 100Gi

# Use existing secret
secrets:
  existingSecret: 'pitch-production-secrets'
```

### Development values.yaml

```yaml
# values-development.yaml

image:
  repository: pitch-api
  tag: latest
  pullPolicy: Never

# Disable persistence for faster setup
postgresql:
  user:
    persistence:
      enabled: false
  simulation:
    persistence:
      enabled: false
  support:
    persistence:
      enabled: false
  analytics:
    persistence:
      enabled: false
  lti:
    persistence:
      enabled: false
  s3:
    persistence:
      enabled: false

mongodb:
  persistence:
    enabled: false

redis:
  persistence:
    enabled: false

rabbitmq:
  persistence:
    enabled: false

# Minimal resources
gateway:
  replicaCount: 1
  resources:
    limits:
      cpu: 200m
      memory: 256Mi
    requests:
      cpu: 100m
      memory: 128Mi

user:
  replicaCount: 1
  resources:
    limits:
      cpu: 200m
      memory: 256Mi

# Disable ingress, use port-forward
ingress:
  enabled: false
```

## Common Operations

### Upgrade

```bash
# Upgrade to new version
helm upgrade pitch ./helm/pitch \
  --namespace pitch \
  --set image.tag=v1.1.0

# View upgrade history
helm history pitch -n pitch

# Rollback to previous version
helm rollback pitch -n pitch
```

### Scaling

```bash
# Scale specific service
kubectl scale deployment/pitch-simulation --replicas=10 -n pitch

# Or update values and upgrade
helm upgrade pitch ./helm/pitch \
  --namespace pitch \
  --set simulation.replicaCount=10
```

### Access Services

```bash
# Port forward to Gateway
kubectl port-forward svc/pitch-gateway 8000:8000 -n pitch

# Port forward to RabbitMQ Management UI
kubectl port-forward svc/pitch-rabbitmq 15672:15672 -n pitch

# Port forward to specific microservice
kubectl port-forward svc/pitch-user 3001:3001 -n pitch
```

### Debugging

```bash
# View logs
kubectl logs -f deployment/pitch-gateway -n pitch
kubectl logs -f deployment/pitch-simulation -n pitch

# Get shell in pod
kubectl exec -it deployment/pitch-user -n pitch -- sh

# Check events
kubectl get events -n pitch --sort-by='.lastTimestamp'

# Describe pod
kubectl describe pod pitch-gateway-xxx -n pitch
```

### Database Operations

```bash
# Access PostgreSQL
kubectl exec -it statefulset/pitch-postgres-user -n pitch -- \
  psql -U pitch_user -d pitch_user

# Run migrations
kubectl exec -it deployment/pitch-user -n pitch -- \
  sh -c "cd apps/api/src/microservices/user && npx prisma migrate deploy"

# Access MongoDB
kubectl exec -it statefulset/pitch-mongodb -n pitch -- \
  mongosh -u admin -p

# Access Redis
kubectl exec -it statefulset/pitch-redis -n pitch -- \
  redis-cli
```

## Validation

### Lint Chart

```bash
helm lint ./helm/pitch
```

### Dry Run

```bash
helm install pitch ./helm/pitch \
  --namespace pitch \
  --dry-run --debug
```

### Template Output

```bash
helm template pitch ./helm/pitch \
  --namespace pitch \
  --values values-production.yaml > rendered-manifests.yaml
```

## Uninstall

```bash
# Uninstall release (keeps PVCs)
helm uninstall pitch -n pitch

# Delete PVCs to remove all data
kubectl delete pvc -l app.kubernetes.io/instance=pitch -n pitch

# Delete namespace
kubectl delete namespace pitch
```

## Troubleshooting

### Chart fails to install

```bash
# Check Helm version
helm version

# Validate values
helm lint ./helm/pitch --values values-production.yaml

# Check for syntax errors
helm template pitch ./helm/pitch --debug
```

### Pods in CrashLoopBackOff

```bash
# Check logs
kubectl logs pod-name -n pitch

# Check previous logs
kubectl logs pod-name -n pitch --previous

# Describe pod for events
kubectl describe pod pod-name -n pitch
```

### Database connection errors

```bash
# Check database pods
kubectl get pods -l app.kubernetes.io/component=postgres-user -n pitch

# Test connection
kubectl exec -it statefulset/pitch-postgres-user -n pitch -- \
  pg_isready -U pitch_user -d pitch_user

# Check secrets
kubectl get secret pitch-secrets -n pitch -o yaml
```

### RabbitMQ connection issues

```bash
# Check RabbitMQ pod
kubectl get pods -l app.kubernetes.io/component=rabbitmq -n pitch

# Check RabbitMQ status
kubectl exec -it statefulset/pitch-rabbitmq -n pitch -- \
  rabbitmq-diagnostics status

# List queues
kubectl exec -it statefulset/pitch-rabbitmq -n pitch -- \
  rabbitmqctl list_queues
```

## Best Practices

### Production Deployment

1. **Use specific image tags** (not `latest`)
2. **Enable persistence** for all databases
3. **Configure resource limits** and requests
4. **Enable autoscaling** for high-traffic services
5. **Use TLS** with cert-manager
6. **Store secrets** in external secret manager (Vault, AWS Secrets Manager)
7. **Set up monitoring** (Prometheus, Grafana)
8. **Configure backups** for databases
9. **Use separate namespaces** for environments
10. **Implement network policies**

### Security

```yaml
# Use external secret manager
secrets:
  existingSecret: 'pitch-production-secrets'

# Enable pod security
podSecurityContext:
  runAsNonRoot: true
  runAsUser: 1001
  fsGroup: 1001

# Enable network policies
networkPolicy:
  enabled: true
```

### Monitoring

```yaml
monitoring:
  enabled: true
  serviceMonitor:
    enabled: true
    interval: 30s
```

## Next Steps

1. Review [README.md](README.md) for detailed chart documentation
2. Customize `values.yaml` for your environment
3. Set up CI/CD pipeline for automated deployments
4. Configure monitoring and alerting
5. Implement backup strategy for databases
6. Set up log aggregation (ELK, Loki)

## Support

- Chart Issues: https://github.com/yourorg/pitch/issues
- Documentation: https://docs.pitch.com/kubernetes
- Email: devops@pitch.com
