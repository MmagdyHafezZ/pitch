import { AdminObservabilityService } from './admin-observability.service';

describe('AdminObservabilityService', () => {
  let service: AdminObservabilityService;

  beforeEach(() => {
    service = new AdminObservabilityService();
  });

  it('stores request logs newest-first', () => {
    service.recordRequest({
      method: 'GET',
      path: '/api/v1/admin/overview',
      url: '/api/v1/admin/overview',
      statusCode: 200,
      durationMs: 10,
      requestAt: '2026-03-20T00:00:00.000Z',
      completedAt: '2026-03-20T00:00:01.000Z',
    });
    service.recordRequest({
      method: 'POST',
      path: '/api/v1/admin/cache/invalidate',
      url: '/api/v1/admin/cache/invalidate',
      statusCode: 200,
      durationMs: 25,
      requestAt: '2026-03-20T00:00:02.000Z',
      completedAt: '2026-03-20T00:00:03.000Z',
    });

    expect(service.listRequestLogs()).toEqual([
      expect.objectContaining({
        method: 'POST',
        path: '/api/v1/admin/cache/invalidate',
      }),
      expect.objectContaining({
        method: 'GET',
        path: '/api/v1/admin/overview',
      }),
    ]);
  });

  it('summarizes webhook providers with processed and failed counts', () => {
    service.recordWebhookEvent({
      provider: 'twilio',
      eventType: 'voice',
      path: '/api/v1/simulation/phone-calls/twilio',
      source: 'live',
      status: 'processed',
      payload: {},
      query: {},
      createdAt: '2026-03-20T00:00:00.000Z',
    });
    service.recordWebhookEvent({
      provider: 'twilio',
      eventType: 'voice',
      path: '/api/v1/simulation/phone-calls/twilio',
      source: 'live',
      status: 'failed',
      payload: {},
      query: {},
      createdAt: '2026-03-20T00:01:00.000Z',
    });

    expect(service.listWebhookProviders()).toEqual([
      {
        provider: 'twilio',
        total: 2,
        processed: 1,
        failed: 1,
        lastReceivedAt: '2026-03-20T00:01:00.000Z',
      },
    ]);
  });

  it('filters webhook events by provider case-insensitively', () => {
    const twilio = service.recordWebhookEvent({
      provider: 'twilio',
      eventType: 'voice',
      path: '/api/v1/simulation/phone-calls/twilio',
      source: 'live',
      status: 'processed',
      payload: { CallSid: 'CA123' },
      query: {},
    });
    service.recordWebhookEvent({
      provider: 'stripe',
      eventType: 'invoice',
      path: '/api/v1/webhooks/stripe',
      source: 'live',
      status: 'processed',
      payload: { id: 'evt_1' },
      query: {},
    });

    expect(service.listWebhookEvents('TWILIO')).toEqual([twilio]);
    expect(service.getWebhookEvent(twilio.id)).toEqual(twilio);
  });

  it('updates stored job runs in place', () => {
    const job = service.recordJobRun({
      jobName: 'generate-daily-challenges',
      status: 'queued',
    });

    service.updateJobRun(job.id, {
      status: 'completed',
      result: { ok: true },
      completedAt: '2026-03-20T00:10:00.000Z',
    });

    expect(service.getJobRun(job.id)).toEqual(
      expect.objectContaining({
        status: 'completed',
        result: { ok: true },
        completedAt: '2026-03-20T00:10:00.000Z',
      }),
    );
  });
});
