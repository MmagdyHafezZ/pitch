import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { lastValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { Public } from '../../../microservices/userManagement/decorators/public.decorator';
import {
  WsEnvelope,
  WsMessageType,
  ConversationStartPayload,
} from '@microservices/simulation/dto/websocket.dto';
import { randomUUID } from 'crypto';

interface ConversationProcessResponse {
  text?: string;
}

@ApiTags('simulation-phone-calls')
@Controller({ path: 'simulation/phone-calls', version: '1' })
export class PhoneCallWebhookController {
  private readonly logger = new Logger(PhoneCallWebhookController.name);

  constructor(
    @Inject('SIMULATION_SERVICE') private simulationService: ClientProxy,
  ) {}

  @Post('twilio')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Twilio voice webhook' })
  async handleTwilioWebhook(
    @Body() body: Record<string, string>,
    @Query() query: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const sessionId = query.sessionId || body.sessionId;
    const userId = query.userId || body.userId;

    if (!sessionId || !userId) {
      const twiml = this.buildErrorTwiML('Missing session context');
      res.type('text/xml').send(twiml);
      return;
    }

    const speech =
      (
        body.SpeechResult ||
        body.speechResult ||
        body['SpeechResult']
      )?.trim?.() || '';
    const startAsAssistant = !speech;

    const envelope: WsEnvelope<ConversationStartPayload> = {
      type: WsMessageType.CONVERSATION_START,
      requestId: randomUUID(),
      sessionId,
      userId,
      payload: {
        text: speech,
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

      const actionUrl = this.buildActionUrl(req, sessionId, userId);
      const twiml = this.buildConversationTwiML(replyText, actionUrl);
      res.type('text/xml').send(twiml);
    } catch (error) {
      this.logger.error('Twilio webhook processing failed', error);
      const twiml = this.buildErrorTwiML(
        'Sorry, I ran into an issue processing that.',
      );
      res.type('text/xml').send(twiml);
    }
  }

  private buildActionUrl(
    req: Request,
    sessionId: string,
    userId: string,
  ): string {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol =
      typeof forwardedProto === 'string'
        ? forwardedProto.split(',')[0]
        : req.protocol;
    const forwardedHost = req.headers['x-forwarded-host'];
    const host =
      (typeof forwardedHost === 'string'
        ? forwardedHost.split(',')[0]
        : Array.isArray(forwardedHost)
          ? forwardedHost[0]
          : req.get('host')) ??
      req.hostname ??
      'localhost';
    const basePath = req.originalUrl.split('?')[0];
    const origin = `${protocol}://${host}`;
    const url = new URL(basePath, origin);
    url.searchParams.set('sessionId', sessionId);
    url.searchParams.set('userId', userId);
    return url.toString();
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
}
