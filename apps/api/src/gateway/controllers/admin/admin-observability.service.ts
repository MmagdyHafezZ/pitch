import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

const REQUEST_LOG_LIMIT = 500;
const ERROR_LOG_LIMIT = 250;
const WEBHOOK_LOG_LIMIT = 250;
const AUDIT_LOG_LIMIT = 500;
const JOB_LOG_LIMIT = 250;

export interface AdminRequestLogEntry {
  id: string;
  method: string;
  path: string;
  url: string;
  statusCode: number;
  durationMs: number;
  requestAt: string;
  completedAt: string;
  ip?: string;
  userId?: string;
  userEmail?: string;
}

export interface AdminErrorLogEntry {
  id: string;
  message: string;
  name?: string;
  statusCode?: number;
  method?: string;
  path?: string;
  level?: string;
  context?: string;
  stack?: string;
  details?: Record<string, unknown>;
  timestamp: string;
  userId?: string;
  userEmail?: string;
}

export interface AdminWebhookEventEntry {
  id: string;
  provider: string;
  eventType: string;
  path: string;
  source: 'live' | 'replay';
  status: 'processed' | 'failed';
  payload: Record<string, unknown>;
  query: Record<string, unknown>;
  response?: Record<string, unknown>;
  error?: string;
  sessionId?: string;
  userId?: string;
  externalId?: string;
  replayedFromId?: string;
  createdAt: string;
}

export interface AdminAuditLogEntry {
  id: string;
  action: string;
  actorUserId?: string;
  actorEmail?: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface AdminJobRunEntry {
  id: string;
  jobName: string;
  status: 'queued' | 'completed' | 'failed';
  triggeredByUserId?: string;
  triggeredByEmail?: string;
  input?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

@Injectable()
export class AdminObservabilityService {
  private readonly requestLogs: AdminRequestLogEntry[] = [];
  private readonly errorLogs: AdminErrorLogEntry[] = [];
  private readonly webhookEvents: AdminWebhookEventEntry[] = [];
  private readonly auditLogs: AdminAuditLogEntry[] = [];
  private readonly jobRuns: AdminJobRunEntry[] = [];
  private debugEnabled = false;

  recordRequest(
    input: Omit<AdminRequestLogEntry, 'id' | 'requestAt' | 'completedAt'> & {
      requestAt?: string;
      completedAt?: string;
    },
  ): AdminRequestLogEntry {
    const entry: AdminRequestLogEntry = {
      id: randomUUID(),
      requestAt: input.requestAt ?? new Date().toISOString(),
      completedAt: input.completedAt ?? new Date().toISOString(),
      ...input,
    };
    this.pushWithLimit(this.requestLogs, entry, REQUEST_LOG_LIMIT);
    return entry;
  }

  listRequestLogs(limit = 100): AdminRequestLogEntry[] {
    return this.requestLogs.slice(0, this.normalizeLimit(limit, 100));
  }

  recordError(
    input: Omit<AdminErrorLogEntry, 'id' | 'timestamp'> & {
      timestamp?: string;
    },
  ): AdminErrorLogEntry {
    const entry: AdminErrorLogEntry = {
      id: randomUUID(),
      timestamp: input.timestamp ?? new Date().toISOString(),
      ...input,
    };
    this.pushWithLimit(this.errorLogs, entry, ERROR_LOG_LIMIT);
    return entry;
  }

  listErrorLogs(limit = 100): AdminErrorLogEntry[] {
    return this.errorLogs.slice(0, this.normalizeLimit(limit, 100));
  }

  recordRuntimeLog(
    input: Omit<AdminErrorLogEntry, 'id' | 'timestamp'> & {
      timestamp?: string;
    },
  ): AdminErrorLogEntry | null {
    if (!this.debugEnabled) {
      return null;
    }

    return this.recordError(input);
  }

  getLogLevelSettings() {
    return {
      debugEnabled: this.debugEnabled,
    };
  }

  setDebugEnabled(debugEnabled: boolean) {
    this.debugEnabled = debugEnabled;
    return this.getLogLevelSettings();
  }

  getRuntimeObservability() {
    return {
      debugEnabled: this.debugEnabled,
      bufferedLogs: this.errorLogs.length,
      bufferedRequests: this.requestLogs.length,
      bufferedAuditLogs: this.auditLogs.length,
    };
  }

  recordWebhookEvent(
    input: Omit<AdminWebhookEventEntry, 'id' | 'createdAt'> & {
      createdAt?: string;
    },
  ): AdminWebhookEventEntry {
    const entry: AdminWebhookEventEntry = {
      id: randomUUID(),
      createdAt: input.createdAt ?? new Date().toISOString(),
      ...input,
    };
    this.pushWithLimit(this.webhookEvents, entry, WEBHOOK_LOG_LIMIT);
    return entry;
  }

  listWebhookProviders(limit = 100) {
    const summary = new Map<
      string,
      {
        provider: string;
        total: number;
        processed: number;
        failed: number;
        lastReceivedAt?: string;
      }
    >();

    for (const event of this.webhookEvents) {
      const existing = summary.get(event.provider) ?? {
        provider: event.provider,
        total: 0,
        processed: 0,
        failed: 0,
      };
      existing.total += 1;
      if (event.status === 'processed') {
        existing.processed += 1;
      } else {
        existing.failed += 1;
      }
      if (
        !existing.lastReceivedAt ||
        existing.lastReceivedAt < event.createdAt
      ) {
        existing.lastReceivedAt = event.createdAt;
      }
      summary.set(event.provider, existing);
    }

    return Array.from(summary.values()).slice(
      0,
      this.normalizeLimit(limit, 100),
    );
  }

  listWebhookEvents(provider?: string, limit = 100): AdminWebhookEventEntry[] {
    const normalizedProvider = provider?.trim().toLowerCase();
    const rows = normalizedProvider
      ? this.webhookEvents.filter(
          (event) => event.provider.toLowerCase() === normalizedProvider,
        )
      : this.webhookEvents;
    return rows.slice(0, this.normalizeLimit(limit, 100));
  }

  getWebhookEvent(id: string): AdminWebhookEventEntry | undefined {
    return this.webhookEvents.find((event) => event.id === id);
  }

  recordAudit(
    input: Omit<AdminAuditLogEntry, 'id' | 'createdAt'> & {
      createdAt?: string;
    },
  ): AdminAuditLogEntry {
    const entry: AdminAuditLogEntry = {
      id: randomUUID(),
      createdAt: input.createdAt ?? new Date().toISOString(),
      ...input,
    };
    this.pushWithLimit(this.auditLogs, entry, AUDIT_LOG_LIMIT);
    return entry;
  }

  listAuditLogs(limit = 100): AdminAuditLogEntry[] {
    return this.auditLogs.slice(0, this.normalizeLimit(limit, 100));
  }

  recordJobRun(
    input: Omit<AdminJobRunEntry, 'id' | 'createdAt'> & { createdAt?: string },
  ): AdminJobRunEntry {
    const entry: AdminJobRunEntry = {
      id: randomUUID(),
      createdAt: input.createdAt ?? new Date().toISOString(),
      ...input,
    };
    this.pushWithLimit(this.jobRuns, entry, JOB_LOG_LIMIT);
    return entry;
  }

  listJobRuns(limit = 100): AdminJobRunEntry[] {
    return this.jobRuns.slice(0, this.normalizeLimit(limit, 100));
  }

  getJobRun(id: string): AdminJobRunEntry | undefined {
    return this.jobRuns.find((job) => job.id === id);
  }

  updateJobRun(
    id: string,
    patch: Partial<Omit<AdminJobRunEntry, 'id' | 'createdAt'>>,
  ): AdminJobRunEntry | undefined {
    const existing = this.jobRuns.find((job) => job.id === id);
    if (!existing) {
      return undefined;
    }
    Object.assign(existing, patch);
    return existing;
  }

  private pushWithLimit<T>(target: T[], value: T, limit: number) {
    target.unshift(value);
    if (target.length > limit) {
      target.length = limit;
    }
  }

  private normalizeLimit(value: number, fallback: number): number {
    return Number.isFinite(value) && value > 0
      ? Math.min(Math.trunc(value), fallback)
      : fallback;
  }
}
