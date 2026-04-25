import { ConsoleLogger, type LoggerService } from '@nestjs/common';
import type { Request, RequestHandler, Response } from 'express';
import {
  context,
  metrics,
  trace,
  SpanKind,
  SpanStatusCode,
} from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  LoggerProvider,
  BatchLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

type SignalName = 'logs' | 'metrics' | 'traces';

type OtlpSignalConfig = {
  endpoint: string;
  headers: Record<string, string>;
};

type OtlpConfig = {
  enabled: boolean;
  serviceName: string;
  serviceVersion: string;
  deploymentEnvironment: string;
  serviceNamespace: string;
  serviceInstanceId: string;
  exportIntervalMillis: number;
  signals: Partial<Record<SignalName, OtlpSignalConfig>>;
};

export type ObservabilityHandle = {
  enabled: boolean;
  logger: LoggerService;
  morganStream: {
    write: (message: string) => void;
  };
  requestMiddleware: RequestHandler;
  shutdown: () => Promise<void>;
};

function parseNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseHeaders(raw: string | undefined): Record<string, string> {
  if (!raw) {
    return {};
  }

  const decodeHeaderValue = (value: string): string => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((headers, entry) => {
      const separator = entry.indexOf('=');
      if (separator <= 0) {
        return headers;
      }

      const key = decodeHeaderValue(entry.slice(0, separator).trim());
      const value = decodeHeaderValue(entry.slice(separator + 1).trim());

      if (key && value) {
        headers[key] = value;
      }

      return headers;
    }, {});
}

function buildSignalEndpoint(baseEndpoint: string, signal: SignalName): string {
  const trimmed = baseEndpoint.replace(/\/+$/, '');
  if (/\/v1\/(logs|metrics|traces)$/u.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed}/v1/${signal}`;
}

function readSignalConfig(signal: SignalName): OtlpSignalConfig | undefined {
  const signalKey = signal.toUpperCase();
  const explicitEndpoint =
    process.env[`OTEL_EXPORTER_OTLP_${signalKey}_ENDPOINT`];
  const sharedEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const endpoint = explicitEndpoint || sharedEndpoint;

  if (!endpoint) {
    return undefined;
  }

  const explicitHeaders =
    process.env[`OTEL_EXPORTER_OTLP_${signalKey}_HEADERS`];
  const sharedHeaders = process.env.OTEL_EXPORTER_OTLP_HEADERS;

  return {
    endpoint: explicitEndpoint || buildSignalEndpoint(sharedEndpoint!, signal),
    headers: parseHeaders(explicitHeaders || sharedHeaders),
  };
}

function readConfig(serviceName: string, serviceVersion: string): OtlpConfig {
  const signals: Partial<Record<SignalName, OtlpSignalConfig>> = {
    traces: readSignalConfig('traces'),
    metrics: readSignalConfig('metrics'),
    logs: readSignalConfig('logs'),
  };

  return {
    enabled: Boolean(signals.traces || signals.metrics || signals.logs),
    serviceName: process.env.OTEL_SERVICE_NAME || serviceName,
    serviceVersion,
    deploymentEnvironment: process.env.NODE_ENV || 'development',
    serviceNamespace: process.env.OTEL_SERVICE_NAMESPACE || 'pitch',
    serviceInstanceId:
      process.env.K_REVISION || process.env.HOSTNAME || 'local-instance',
    exportIntervalMillis: parseNumberEnv('OTEL_METRIC_EXPORT_INTERVAL', 30000),
    signals,
  };
}

function resolveRouteLabel(req: Request): string {
  const routePath =
    typeof req.route?.path === 'string'
      ? req.route.path
      : Array.isArray(req.route?.path)
        ? req.route.path.join('|')
        : undefined;
  const baseUrl = typeof req.baseUrl === 'string' ? req.baseUrl : '';

  if (routePath) {
    return `${baseUrl}${routePath}`;
  }

  return req.path || req.originalUrl || 'unknown';
}

function serializeMessage(message: unknown): string {
  if (typeof message === 'string') {
    return message;
  }

  if (message instanceof Error) {
    return message.stack || message.message;
  }

  try {
    return JSON.stringify(message);
  } catch {
    return String(message);
  }
}

class OtelNestLogger extends ConsoleLogger {
  constructor(
    context: string,
    private readonly otelLogger: ReturnType<typeof logs.getLogger> | undefined,
  ) {
    super(context, {
      timestamp: true,
    });
  }

  log(message: unknown, context?: string): void {
    super.log(message, context);
    this.emitLog('INFO', SeverityNumber.INFO, message, context);
  }

  error(message: unknown, stack?: string, context?: string): void {
    super.error(message, stack, context);
    this.emitLog('ERROR', SeverityNumber.ERROR, message, context, stack);
  }

  warn(message: unknown, context?: string): void {
    super.warn(message, context);
    this.emitLog('WARN', SeverityNumber.WARN, message, context);
  }

  debug(message: unknown, context?: string): void {
    super.debug(message, context);
    this.emitLog('DEBUG', SeverityNumber.DEBUG, message, context);
  }

  verbose(message: unknown, context?: string): void {
    super.verbose(message, context);
    this.emitLog('TRACE', SeverityNumber.TRACE, message, context);
  }

  fatal(message: unknown, stack?: string, context?: string): void {
    super.fatal(message, stack, context);
    this.emitLog('FATAL', SeverityNumber.FATAL, message, context, stack);
  }

  private emitLog(
    severityText: string,
    severityNumber: SeverityNumber,
    message: unknown,
    contextName?: string,
    stack?: string,
  ) {
    if (!this.otelLogger) {
      return;
    }

    const spanContext = trace.getActiveSpan()?.spanContext();
    this.otelLogger.emit({
      severityText,
      severityNumber,
      body: serializeMessage(message),
      context: context.active(),
      attributes: {
        'log.context': contextName || this.context || 'Application',
        ...(stack ? { 'exception.stacktrace': stack } : {}),
        ...(spanContext
          ? {
              trace_id: spanContext.traceId,
              span_id: spanContext.spanId,
            }
          : {}),
      },
    });
  }
}

export function initializeObservability(
  serviceName = 'pitch-api',
  serviceVersion = '0.0.1',
): ObservabilityHandle {
  const config = readConfig(serviceName, serviceVersion);
  const logger = new OtelNestLogger('PITCH', undefined);

  if (!config.enabled) {
    return {
      enabled: false,
      logger,
      morganStream: {
        write: (message: string) => {
          logger.log(message.trim(), 'HTTPAccess');
        },
      },
      requestMiddleware: (_req, _res, next) => next(),
      shutdown: async () => undefined,
    };
  }

  const resource = resourceFromAttributes({
    'service.name': config.serviceName,
    'service.version': config.serviceVersion,
    'service.namespace': config.serviceNamespace,
    'service.instance.id': config.serviceInstanceId,
    'deployment.environment': config.deploymentEnvironment,
  });

  const tracerProvider = new NodeTracerProvider({
    resource,
    spanProcessors: config.signals.traces
      ? [
          new BatchSpanProcessor(
            new OTLPTraceExporter({
              url: config.signals.traces.endpoint,
              headers: config.signals.traces.headers,
            }),
          ),
        ]
      : [],
  });
  tracerProvider.register();

  const meterProvider = new MeterProvider({
    resource,
    readers: config.signals.metrics
      ? [
          new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter({
              url: config.signals.metrics.endpoint,
              headers: config.signals.metrics.headers,
            }),
            exportIntervalMillis: config.exportIntervalMillis,
          }),
        ]
      : [],
  });
  metrics.setGlobalMeterProvider(meterProvider);

  const logProvider = new LoggerProvider({
    resource,
    processors: config.signals.logs
      ? [
          new BatchLogRecordProcessor(
            new OTLPLogExporter({
              url: config.signals.logs.endpoint,
              headers: config.signals.logs.headers,
            }),
          ),
        ]
      : [],
  });
  logs.setGlobalLoggerProvider(logProvider);

  const otelLogger = logs.getLogger(
    'pitch-observability',
    config.serviceVersion,
  );
  const otelNestLogger = new OtelNestLogger('PITCH', otelLogger);
  const tracer = trace.getTracer('pitch-http-server', config.serviceVersion);
  const meter = metrics.getMeter('pitch-http-server', config.serviceVersion);

  const requestCounter = meter.createCounter(
    'pitch_http_server_requests_total',
    {
      description: 'Total number of completed HTTP requests.',
    },
  );
  const requestDuration = meter.createHistogram(
    'pitch_http_server_request_duration',
    {
      description: 'HTTP request duration.',
      unit: 'ms',
    },
  );
  const activeRequests = meter.createUpDownCounter(
    'pitch_http_server_active_requests',
    {
      description: 'Number of active HTTP requests currently being processed.',
    },
  );

  const requestMiddleware: RequestHandler = (
    req: Request,
    res: Response,
    next,
  ) => {
    const start = process.hrtime.bigint();
    const requestMethod = req.method;
    const requestTarget = req.originalUrl || req.url;

    activeRequests.add(1, {
      'http.request.method': requestMethod,
    });

    tracer.startActiveSpan(
      `${requestMethod} ${requestTarget}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          'http.request.method': requestMethod,
          'url.path': requestTarget,
          'server.address': req.hostname,
          'user_agent.original': req.get('user-agent') || 'unknown',
        },
      },
      (span) => {
        let closed = false;

        const finalize = (error?: Error) => {
          if (closed) {
            return;
          }
          closed = true;

          const durationMs =
            Number(process.hrtime.bigint() - start) / 1_000_000;
          const route = resolveRouteLabel(req);
          const statusCode = res.statusCode;
          const attributes = {
            'http.request.method': requestMethod,
            'http.response.status_code': statusCode,
            'http.route': route,
          };

          activeRequests.add(-1, {
            'http.request.method': requestMethod,
          });
          requestCounter.add(1, attributes);
          requestDuration.record(durationMs, attributes);

          span.setAttribute('http.route', route);
          span.setAttribute('http.response.status_code', statusCode);
          span.setAttribute('http.request.duration_ms', durationMs);

          if (error) {
            span.recordException(error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message,
            });
          } else if (statusCode >= 500) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
            });
          } else {
            span.setStatus({
              code: SpanStatusCode.OK,
            });
          }

          span.end();
        };

        res.once('finish', () => finalize());
        res.once('close', () => finalize());
        res.once('error', (error) => finalize(error));

        next();
      },
    );
  };

  let shutdownStarted = false;
  const shutdown = async () => {
    if (shutdownStarted) {
      return;
    }
    shutdownStarted = true;

    await Promise.allSettled([
      tracerProvider.forceFlush().then(() => tracerProvider.shutdown()),
      meterProvider.forceFlush().then(() => meterProvider.shutdown()),
      logProvider.forceFlush().then(() => logProvider.shutdown()),
    ]);
  };

  return {
    enabled: true,
    logger: otelNestLogger,
    morganStream: {
      write: (message: string) => {
        otelNestLogger.log(message.trim(), 'HTTPAccess');
      },
    },
    requestMiddleware,
    shutdown,
  };
}
