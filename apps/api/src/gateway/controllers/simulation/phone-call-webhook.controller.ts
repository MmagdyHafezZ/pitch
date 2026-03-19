import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../../microservices/userManagement/decorators/public.decorator';
import { VapiContextService } from '@microservices/simulation/phone/vapi-context.service';
import { PhoneCallService } from '@microservices/simulation/phone/phone-call.service';
import { SessionService } from '@microservices/simulation/services/session.service';

interface VapiServerEnvelope {
  message?: {
    type?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface VapiVoiceRequestEnvelope {
  type?: string;
  text?: string;
  sampleRate?: number;
  message?: {
    type?: string;
    text?: string;
    sampleRate?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

@ApiTags('simulation-phone-calls')
@Controller({ path: 'simulation/phone-calls', version: '1' })
export class PhoneCallWebhookController {
  private readonly logger = new Logger(PhoneCallWebhookController.name);

  constructor(
    private readonly vapiContext: VapiContextService,
    private readonly sessionService: SessionService,
    private readonly phoneCallService: PhoneCallService,
  ) {}

  @Post('vapi/voice')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Custom TTS endpoint used by Vapi phone calls' })
  async handleVapiVoiceRequest(
    @Query('token') token: string,
    @Body() body: VapiVoiceRequestEnvelope,
    @Res() res: Response,
  ) {
    const context = this.vapiContext.verifyToken(token);
    const type = this.extractVoiceRequestType(body);
    const text = this.extractVoiceRequestText(body);
    const sampleRate = this.extractVoiceSampleRate(body) ?? 24000;
    const callId = this.extractCallId(body);

    this.logger.log(
      `vapi.voice.request session=${context.sessionId} user=${context.userId} call=${callId ?? 'unknown'} type=${type} sampleRate=${sampleRate} text="${this.previewText(text)}" bodyKeys=${this.listObjectKeys(body)}`,
    );

    if (type !== 'voice-request') {
      throw new BadRequestException(
        `Unsupported Vapi voice request type "${type}".`,
      );
    }

    if (!text) {
      throw new BadRequestException(
        'Vapi voice request must include text to synthesize.',
      );
    }

    const result = await this.phoneCallService.synthesizePhoneCallAudio({
      sessionId: context.sessionId,
      userId: context.userId,
      text,
      sampleRate,
    });

    this.logger.log(
      `vapi.voice.response session=${context.sessionId} user=${context.userId} call=${callId ?? 'unknown'} sampleRate=${sampleRate} bytes=${result.audioBuffer.length}`,
    );

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.status(HttpStatus.OK).send(result.audioBuffer);
  }

  @Post('vapi/server')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Vapi server-event webhook for phone calls' })
  async handleVapiServerEvent(
    @Query('token') token: string,
    @Body() body: VapiServerEnvelope,
  ) {
    const context = this.vapiContext.verifyToken(token);
    const message = body.message ?? {};
    const type = typeof message.type === 'string' ? message.type : 'unknown';
    const status = this.extractStatus(message);
    const endedReason = this.extractEndReasonOrUndefined(message);
    const callId = this.extractCallId(body);

    this.logger.log(
      `vapi.event.received session=${context.sessionId} user=${context.userId} call=${callId ?? 'unknown'} type=${type} status=${status ?? 'unknown'} endedReason=${endedReason ?? 'unknown'} bodyKeys=${this.listObjectKeys(body)}`,
    );

    switch (type) {
      case 'status-update': {
        this.logger.log(
          `vapi.event.status session=${context.sessionId} user=${context.userId} call=${callId ?? 'unknown'} status=${status ?? 'unknown'} payload=${this.safeJson(message)}`,
        );
        if (status === 'connected' || status === 'in-progress') {
          this.logger.log(
            `vapi.event.connected session=${context.sessionId} user=${context.userId} call=${callId ?? 'unknown'} status=${status}`,
          );
        }
        if (
          status === 'failed' ||
          status === 'busy' ||
          status === 'no-answer' ||
          status === 'canceled'
        ) {
          this.logger.warn(
            `vapi.event.failure session=${context.sessionId} user=${context.userId} call=${callId ?? 'unknown'} status=${status} endedReason=${endedReason ?? 'unknown'} payload=${this.safeJson(message)}`,
          );
        }
        break;
      }
      case 'speech-update':
        this.logger.log(
          `vapi.event.speech session=${context.sessionId} user=${context.userId} call=${callId ?? 'unknown'} payload=${this.safeJson(message)}`,
        );
        break;
      case 'transcript':
        this.logger.log(
          `vapi.event.transcript session=${context.sessionId} user=${context.userId} call=${callId ?? 'unknown'} payload=${this.safeJson(message)}`,
        );
        break;
      case 'end-of-call-report': {
        const reason = endedReason ?? 'unknown';
        this.logger.log(
          `vapi.event.end_of_call session=${context.sessionId} user=${context.userId} call=${callId ?? 'unknown'} reason=${reason} payload=${this.safeJson(message)}`,
        );
        await this.endSessionIfNeeded(
          context.sessionId,
          context.userId,
          `phone_call_completed:${reason}`,
        );
        break;
      }
      case 'hang':
        this.logger.warn(
          `vapi.event.hang session=${context.sessionId} user=${context.userId} call=${callId ?? 'unknown'} endedReason=${endedReason ?? 'unknown'} payload=${this.safeJson(message)}`,
        );
        await this.endSessionIfNeeded(
          context.sessionId,
          context.userId,
          'phone_call_hang',
        );
        break;
      default:
        this.logger.log(
          `vapi.event.ignored session=${context.sessionId} user=${context.userId} call=${callId ?? 'unknown'} type=${type} payload=${this.safeJson(message)}`,
        );
        break;
    }

    return { ok: true };
  }

  private async endSessionIfNeeded(
    sessionId: string,
    userId: string,
    reason: string,
  ): Promise<void> {
    try {
      await this.sessionService.end(sessionId, { reason }, userId);
    } catch (error) {
      this.logger.warn(
        `vapi.event.end_session_failed session=${sessionId} user=${userId} reason=${reason} error=${(error as Error)?.message ?? error}`,
      );
    }
  }

  private extractEndReasonOrUndefined(
    message: Record<string, unknown>,
  ): string | undefined {
    const endedReason = this.readString(message, 'endedReason');
    const artifact = message.artifact;
    if (artifact && typeof artifact === 'object') {
      const artifactReason = this.readString(
        artifact as Record<string, unknown>,
        'endedReason',
      );
      if (artifactReason) {
        return artifactReason;
      }
    }

    return endedReason;
  }

  private extractStatus(message: Record<string, unknown>): string | undefined {
    const directStatus = this.readString(message, 'status');
    if (directStatus) {
      return directStatus;
    }

    const artifact = message.artifact;
    if (artifact && typeof artifact === 'object') {
      const artifactStatus = this.readString(
        artifact as Record<string, unknown>,
        'status',
      );
      if (artifactStatus) {
        return artifactStatus;
      }
    }

    return undefined;
  }

  private extractVoiceRequestType(payload: VapiVoiceRequestEnvelope): string {
    return (
      this.readString(payload as Record<string, unknown>, 'type') ??
      this.readNestedString(
        payload as Record<string, unknown>,
        'message',
        'type',
      ) ??
      'unknown'
    );
  }

  private extractVoiceRequestText(
    payload: VapiVoiceRequestEnvelope,
  ): string | undefined {
    return (
      this.readString(payload as Record<string, unknown>, 'text') ??
      this.readNestedString(
        payload as Record<string, unknown>,
        'message',
        'text',
      )
    );
  }

  private extractVoiceSampleRate(
    payload: VapiVoiceRequestEnvelope,
  ): number | undefined {
    return (
      this.readNumber(payload as Record<string, unknown>, 'sampleRate') ??
      this.readNestedNumber(
        payload as Record<string, unknown>,
        'message',
        'sampleRate',
      )
    );
  }

  private readString(
    source: Record<string, unknown>,
    key: string,
  ): string | undefined {
    const value = source[key];
    return typeof value === 'string' && value.trim().length > 0
      ? value
      : undefined;
  }

  private readNumber(
    source: Record<string, unknown>,
    key: string,
  ): number | undefined {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }

  private readNestedString(
    source: Record<string, unknown>,
    ...path: string[]
  ): string | undefined {
    let current: unknown = source;

    for (const segment of path) {
      if (!current || typeof current !== 'object') {
        return undefined;
      }

      current = (current as Record<string, unknown>)[segment];
    }

    return typeof current === 'string' && current.trim().length > 0
      ? current
      : undefined;
  }

  private readNestedNumber(
    source: Record<string, unknown>,
    ...path: string[]
  ): number | undefined {
    if (path.length === 0) {
      return undefined;
    }

    const parentPath = path.slice(0, -1);
    const leaf = path[path.length - 1];
    let current: unknown = source;

    for (const segment of parentPath) {
      if (!current || typeof current !== 'object') {
        return undefined;
      }

      current = (current as Record<string, unknown>)[segment];
    }

    if (!current || typeof current !== 'object') {
      return undefined;
    }

    return this.readNumber(current as Record<string, unknown>, leaf);
  }

  private extractCallId(payload: unknown): string | undefined {
    if (!payload || typeof payload !== 'object') {
      return undefined;
    }

    const record = payload as Record<string, unknown>;
    return (
      this.readString(record, 'callId') ??
      this.readNestedString(record, 'call', 'id') ??
      this.readNestedString(record, 'message', 'callId') ??
      this.readNestedString(record, 'message', 'call', 'id') ??
      this.readNestedString(record, 'message', 'artifact', 'callId') ??
      this.readNestedString(record, 'message', 'artifact', 'call', 'id') ??
      this.readNestedString(record, 'artifact', 'callId') ??
      this.readNestedString(record, 'artifact', 'call', 'id')
    );
  }

  private listObjectKeys(value: unknown): string {
    if (!value || typeof value !== 'object') {
      return 'none';
    }

    const keys = Object.keys(value as Record<string, unknown>).sort();
    return keys.length > 0 ? keys.join(',') : 'none';
  }

  private safeJson(value: unknown): string {
    try {
      return JSON.stringify(this.sanitizeForLog(value));
    } catch {
      return '[unserializable]';
    }
  }

  private sanitizeForLog(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((entry) => this.sanitizeForLog(entry));
    }

    if (!value || typeof value !== 'object') {
      if (typeof value === 'string') {
        return this.sanitizeStringForLog(value);
      }
      return value;
    }

    const record = value as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(record)) {
      if (this.shouldRedactKey(key)) {
        sanitized[key] = '[redacted]';
        continue;
      }

      sanitized[key] = this.sanitizeForLog(entry);
    }

    return sanitized;
  }

  private sanitizeStringForLog(value: string): string {
    try {
      const parsed = new URL(value);
      if (parsed.searchParams.has('token')) {
        parsed.searchParams.set('token', '[redacted]');
      }
      return parsed.toString();
    } catch {
      return value;
    }
  }

  private shouldRedactKey(key: string): boolean {
    const normalized = key.trim().toLowerCase();
    return (
      normalized === 'token' ||
      normalized.endsWith('token') ||
      normalized.endsWith('secret') ||
      normalized.endsWith('apikey') ||
      normalized.endsWith('api_key') ||
      normalized === 'authorization' ||
      normalized === 'signature' ||
      normalized === 'twilioauthtoken'
    );
  }

  private previewText(value: string | undefined, maxLength = 120): string {
    if (!value) {
      return '';
    }

    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, maxLength - 3)}...`;
  }
}
