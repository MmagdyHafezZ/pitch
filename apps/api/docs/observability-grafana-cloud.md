# Grafana Cloud OTLP for Kubernetes

This API now supports sending traces, metrics, and logs directly to Grafana
Cloud over OTLP/HTTP from the application process.

This is the right fit for the current Kubernetes deployment because the app
pushes telemetry directly instead of relying on Prometheus scraping.

## What Was Added

- HTTP request tracing
- HTTP request metrics
- Nest application logs and access logs over OTLP

The integration is wired in:

- `apps/api/src/main.ts`
- `apps/api/src/observability/otel.ts`

## Required Environment Variables

In Grafana Cloud, go to:

- `Connections -> Add new connection -> OpenTelemetry`

Grafana Cloud provides environment variables similar to:

```env
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-<region>.grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <base64-credentials>
```

Set these in your Kubernetes deployment.

Grafana Cloud sometimes provides `OTEL_EXPORTER_OTLP_HEADERS` in URL-encoded
shell form. This app accepts both:

```env
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <base64-credentials>
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic%20<base64-credentials>
```

Also set:

```env
OTEL_SERVICE_NAME=pitch-api
OTEL_SERVICE_NAMESPACE=pitch
OTEL_METRIC_EXPORT_INTERVAL=30000
```

Optional:

```env
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=
OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=
OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=
OTEL_EXPORTER_OTLP_TRACES_HEADERS=
OTEL_EXPORTER_OTLP_METRICS_HEADERS=
OTEL_EXPORTER_OTLP_LOGS_HEADERS=
```

If the signal-specific variables are unset, the app derives:

- `<OTEL_EXPORTER_OTLP_ENDPOINT>/v1/traces`
- `<OTEL_EXPORTER_OTLP_ENDPOINT>/v1/metrics`
- `<OTEL_EXPORTER_OTLP_ENDPOINT>/v1/logs`

## Existing App Variables

Keep the normal production env vars in place:

- `DEP_MODE=prod`
- `PORT=8000`
- `JWT_SECRET`
- `CLOUDAMQP_URL`
- `REDIS_URL`
- `MONGODB_URI`
- all database URLs

If you still want the benchmark token path for `k6`, keep:

```env
DEV_BYPASS_ENABLED=true
DEV_BYPASS_TOKEN=pitch-perf-static-token
DEV_BYPASS_EMAIL=dev@local
DEV_BYPASS_NAME=Performance Runner
DEV_BYPASS_USER_ID=perf-runner
```

## What Gets Exported

Metrics:

- `pitch_http_server_requests_total`
- `pitch_http_server_request_duration`
- `pitch_http_server_active_requests`

Traces:

- one server span per HTTP request

Logs:

- Nest logger output
- `morgan` access logs

## Deployment Notes

- The current implementation is wired into `apps/api/src/main.ts`, which is the
  entrypoint used by the Kubernetes deployment.
- If you later deploy standalone microservice entrypoints separately, they are
  not yet instrumented by this change.
- If OTLP env vars are missing, the app falls back to normal console logging and
  disables OTLP export cleanly.
