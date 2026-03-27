import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { randomUUID } from 'node:crypto';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import {
  WsEnvelope,
  WsMessageType,
  type ConversationStartPayload,
} from '@microservices/simulation/dto/websocket.dto';

interface ConversationProcessResponse {
  text?: string;
}

export interface PhoneWebhookRequestContext {
  protocol?: string;
  forwardedProto?: string | string[];
  forwardedHost?: string | string[];
  host?: string;
  hostname?: string;
  originalUrl?: string;
}

export interface PhoneWebhookResult {
  status: 'processed' | 'failed';
  statusCode: number;
  provider: 'twilio';
  eventType: 'voice';
  sessionId?: string;
  userId?: string;
  replyText?: string;
  actionUrl?: string;
  twiml: string;
  externalId?: string;
  error?: string;
}

@Injectable()
export class PhoneCallWebhookService {
  private readonly logger = new Logger(PhoneCallWebhookService.name);

  constructor(
    @Inject('SIMULATION_SERVICE')
    private readonly simulationService: ClientProxy,
    private readonly configService: ConfigService,
  ) {}

  async processTwilioWebhook(
    body: Record<string, unknown>,
    query: Record<string, unknown>,
    context: {
      request?: PhoneWebhookRequestContext;
    } = {},
  ): Promise<PhoneWebhookResult> {
    const sessionId =
      this.readString(query.sessionId) || this.readString(body.sessionId);
    const userId =
      this.readString(query.userId) || this.readString(body.userId);
    const externalId =
      this.readString(body.CallSid) || this.readString(body.callSid);

    if (!sessionId || !userId) {
      const result: PhoneWebhookResult = {
        status: 'failed',
        statusCode: HttpStatus.OK,
        provider: 'twilio',
        eventType: 'voice',
        twiml: this.buildErrorTwiML('Missing session context'),
        error: 'Missing session context',
        externalId,
      };
      return result;
    }

    const speech =
      this.readString(body.SpeechResult) ||
      this.readString(body.speechResult) ||
      '';
    const trimmedSpeech = speech.trim();
    const startAsAssistant = trimmedSpeech.length === 0;

    const envelope: WsEnvelope<ConversationStartPayload> = {
      type: WsMessageType.CONVERSATION_START,
      requestId: randomUUID(),
      sessionId,
      userId,
      payload: {
        text: trimmedSpeech,
        startAsAssistant,
      },
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await lastValueFrom(
        this.simulationService
          .send<ConversationProcessResponse>(
            SIMULATION_SERVICE_PATTERNS.CONVERSATION_PROCESS,
            envelope,
          )
          .pipe(timeout(20000)),
      );

      const replyText =
        typeof response?.text === 'string' && response.text.trim().length > 0
          ? response.text
          : 'Thanks for sharing. How else can I help?';
      const actionUrl = this.buildActionUrl(context.request, sessionId, userId);
      const result: PhoneWebhookResult = {
        status: 'processed',
        statusCode: HttpStatus.OK,
        provider: 'twilio',
        eventType: 'voice',
        sessionId,
        userId,
        replyText,
        actionUrl,
        twiml: this.buildConversationTwiML(replyText, actionUrl),
        externalId,
      };
      return result;
    } catch (error) {
      this.logger.error('Twilio webhook processing failed', error);
      const result: PhoneWebhookResult = {
        status: 'failed',
        statusCode: HttpStatus.OK,
        provider: 'twilio',
        eventType: 'voice',
        sessionId,
        userId,
        twiml: this.buildErrorTwiML(
          'Sorry, I ran into an issue processing that.',
        ),
        externalId,
        error: (error as Error)?.message ?? 'Webhook processing failed',
      };
      return result;
    }
  }

  private buildActionUrl(
    request: PhoneWebhookRequestContext | undefined,
    sessionId: string,
    userId: string,
  ): string {
    const configuredUrl =
      this.configService.get<string>('PHONE_CALL_WEBHOOK_URL') ||
      process.env.PHONE_CALL_WEBHOOK_URL;
    const fallbackUrl = configuredUrl
      ? new URL(configuredUrl)
      : new URL('http://localhost/api/v1/simulation/phone-calls/twilio');

    if (request?.originalUrl) {
      const forwardedProto = request.forwardedProto;
      const protocol =
        typeof forwardedProto === 'string'
          ? forwardedProto.split(',')[0]
          : (request.protocol ?? fallbackUrl.protocol.replace(':', ''));
      const forwardedHost = request.forwardedHost;
      const host =
        (typeof forwardedHost === 'string'
          ? forwardedHost.split(',')[0]
          : Array.isArray(forwardedHost)
            ? forwardedHost[0]
            : request.host) ??
        request.hostname ??
        fallbackUrl.host;
      const basePath = request.originalUrl.split('?')[0];
      const actionUrl = new URL(basePath, `${protocol}://${host}`);
      actionUrl.searchParams.set('sessionId', sessionId);
      actionUrl.searchParams.set('userId', userId);
      return actionUrl.toString();
    }

    fallbackUrl.searchParams.set('sessionId', sessionId);
    fallbackUrl.searchParams.set('userId', userId);
    return fallbackUrl.toString();
  }

  private buildConversationTwiML(message: string, actionUrl: string): string {
    const safeMessage = this.escapeXml(message);
    const safeAction = this.escapeXml(actionUrl);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Gather input="speech" action="${safeAction}" method="POST" speechTimeout="auto">\n    <Say>${safeMessage}</Say>\n  </Gather>\n  <Say>Sorry, I didn't catch that. Please try again.</Say>\n</Response>`;
  }

  private buildErrorTwiML(message: string): string {
    const safeMessage = this.escapeXml(message);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Say>${safeMessage}</Say>\n  <Hangup />\n</Response>`;
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }
}
