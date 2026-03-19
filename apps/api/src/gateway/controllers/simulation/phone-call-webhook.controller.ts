import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { randomUUID } from 'crypto';
import { Public } from '../../../microservices/userManagement/decorators/public.decorator';
import { VapiContextService } from '@microservices/simulation/phone/vapi-context.service';
import { PhoneCallService } from '@microservices/simulation/phone/phone-call.service';
import { SessionService } from '@microservices/simulation/services/session.service';
import { ConversationOrchestrationService } from '@microservices/simulation/services/conversation-orchestration.service';
import {
  WsEnvelope,
  ConversationStartPayload,
  WsMessageType,
} from '@microservices/simulation/dto/websocket.dto';
import type { ConversationStreamEvent } from '@microservices/simulation/dto/conversation-stream.types';

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

interface VapiChatCompletionMessage {
  role?: string;
  content?: unknown;
}

interface VapiChatCompletionRequestEnvelope {
  model?: string;
  stream?: boolean;
  messages?: VapiChatCompletionMessage[];
  [key: string]: unknown;
}

const PHONE_STARTER_PROMPT_PREFIX = '[PITCH_STARTER_PROMPT]';

@ApiTags('simulation-phone-calls')
@Controller({ path: 'simulation/phone-calls', version: '1' })
export class PhoneCallWebhookController {
  private readonly logger = new Logger(PhoneCallWebhookController.name);

  constructor(
    private readonly vapiContext: VapiContextService,
    private readonly sessionService: SessionService,
    private readonly phoneCallService: PhoneCallService,
    private readonly conversationOrchestration: ConversationOrchestrationService,
  ) {}

  @Post('vapi/llm/:token/chat/completions')
  @Public()
  @ApiOperation({
    summary: 'OpenAI-compatible custom LLM endpoint used by Vapi phone calls',
  })
  async handleVapiChatCompletions(
    @Param('token') token: string,
    @Body() body: VapiChatCompletionRequestEnvelope,
    @Res() res: Response,
  ) {
    const context = this.vapiContext.verifyToken(token);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const latestUserMessage = this.extractLatestUserMessage(messages);
    const starterPrompt = this.extractStarterPrompt(messages);
    const startAsAssistant = !latestUserMessage;
    const callId = this.extractCallId(body);
    const requestId = randomUUID();
    const startedAt = Date.now();
    const model = this.resolveChatCompletionModel(body);
    const envelope: WsEnvelope<ConversationStartPayload> = {
      type: WsMessageType.CONVERSATION_START,
      requestId,
      sessionId: context.sessionId,
      userId: context.userId,
      payload: {
        text: latestUserMessage ?? '',
        startAsAssistant,
        ...(starterPrompt ? { starterPrompt } : {}),
        skipTts: true,
      },
      timestamp: new Date().toISOString(),
    };

    this.logger.log(
      `vapi.llm.request session=${context.sessionId} user=${context.userId} call=${callId ?? 'unknown'} stream=${body.stream === true} startAsAssistant=${startAsAssistant} messageCount=${messages.length} bodyKeys=${this.listObjectKeys(body)} text="${this.previewText(latestUserMessage)}"`,
    );

    if (body.stream === true) {
      await this.streamCustomLlmResponse({
        context,
        callId,
        requestId,
        model,
        envelope,
        res,
        startedAt,
      });
      return;
    }

    const completion = await this.collectCustomLlmResponse(envelope);

    this.logPitchModelResponse({
      sessionId: context.sessionId,
      userId: context.userId,
      callId,
      requestId,
      model,
      text: completion.fullText,
      hangupReason: completion.hangupReason,
    });

    this.logger.log(
      `vapi.llm.response session=${context.sessionId} user=${context.userId} call=${callId ?? 'unknown'} hangup=${completion.hangupReason ? 'true' : 'false'} text="${this.previewText(completion.fullText)}"`,
    );

    if (completion.hangupReason) {
      await this.requestPhoneHangup(
        context.sessionId,
        context.userId,
        completion.hangupReason,
      );
    }

    res.status(HttpStatus.OK).json(
      this.buildChatCompletionResponse({
        requestId,
        model,
        content: completion.fullText,
      }),
    );
  }

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
    const controlUrl = this.extractMonitorUrl(message, 'controlUrl');
    const listenUrl = this.extractMonitorUrl(message, 'listenUrl');

    this.logger.log(
      `vapi.event.received session=${context.sessionId} user=${context.userId} call=${callId ?? 'unknown'} type=${type} status=${status ?? 'unknown'} endedReason=${endedReason ?? 'unknown'} bodyKeys=${this.listObjectKeys(body)}`,
    );

    if (callId) {
      await this.phoneCallService
        .syncPhoneCallRuntimeFromWebhook({
          sessionId: context.sessionId,
          callId,
          status,
          endedReason,
          controlUrl,
          listenUrl,
        })
        .catch((error) => {
          this.logger.warn(
            `vapi.event.runtime_sync_failed session=${context.sessionId} user=${context.userId} call=${callId} error=${(error as Error)?.message ?? error}`,
          );
        });
    }

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
        if (this.isTerminalStatus(status)) {
          const reason = this.buildStatusEndReason(status, endedReason);
          this.logger.log(
            `vapi.event.status_terminal session=${context.sessionId} user=${context.userId} call=${callId ?? 'unknown'} status=${status ?? 'unknown'} reason=${reason}`,
          );
          await this.endSessionIfNeeded(
            context.sessionId,
            context.userId,
            reason,
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

  private async streamCustomLlmResponse(input: {
    context: { sessionId: string; userId: string };
    callId?: string;
    requestId: string;
    model: string;
    envelope: WsEnvelope<ConversationStartPayload>;
    res: Response;
    startedAt: number;
  }): Promise<void> {
    const { context, callId, requestId, model, envelope, res, startedAt } =
      input;
    const responseId = `chatcmpl_${requestId}`;
    const created = Math.floor(Date.now() / 1000);
    const stream$ = this.conversationOrchestration.stream(envelope);
    let wroteAssistantRole = false;
    let firstDeltaLatencyMs: number | null = null;
    let completionText = '';
    let hangupReason: string | undefined;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const flush = () => (res as Response & { flush?: () => void }).flush?.();

    this.logger.log(
      `vapi.llm.stream.open session=${context.sessionId} user=${context.userId} call=${callId ?? 'unknown'} model=${model}`,
    );

    try {
      await new Promise<void>((resolve, reject) => {
        const subscription = stream$.subscribe({
          next: (event: ConversationStreamEvent) => {
            if (event.type === 'delta' && event.data.delta) {
              if (firstDeltaLatencyMs == null) {
                firstDeltaLatencyMs = Date.now() - startedAt;
                this.logger.log(
                  `vapi.llm.stream.first_delta session=${context.sessionId} user=${context.userId} call=${callId ?? 'unknown'} latencyMs=${firstDeltaLatencyMs} chars=${event.data.delta.length}`,
                );
              }

              completionText += event.data.delta;
              res.write(
                `data: ${JSON.stringify(
                  this.buildChatCompletionChunk({
                    responseId,
                    created,
                    model,
                    delta: {
                      ...(wroteAssistantRole ? {} : { role: 'assistant' }),
                      content: event.data.delta,
                    },
                  }),
                )}\n\n`,
              );
              wroteAssistantRole = true;
              flush();
              return;
            }

            if (event.type === 'completed') {
              completionText = event.data.fullText;
              if (!wroteAssistantRole && completionText.trim().length > 0) {
                res.write(
                  `data: ${JSON.stringify(
                    this.buildChatCompletionChunk({
                      responseId,
                      created,
                      model,
                      delta: {
                        role: 'assistant',
                        content: completionText,
                      },
                    }),
                  )}\n\n`,
                );
                wroteAssistantRole = true;
                flush();
              }
              return;
            }

            if (event.type === 'hangup_requested') {
              hangupReason = event.data.reason;
            }
          },
          error: (error) => {
            subscription.unsubscribe();
            reject(error instanceof Error ? error : new Error(String(error)));
          },
          complete: () => {
            resolve();
          },
        });
      });

      if (hangupReason) {
        void this.requestPhoneHangup(
          context.sessionId,
          context.userId,
          hangupReason,
        );
      }

      this.logPitchModelResponse({
        sessionId: context.sessionId,
        userId: context.userId,
        callId,
        requestId,
        model,
        text: completionText,
        hangupReason,
      });

      this.logger.log(
        `vapi.llm.stream.completed session=${context.sessionId} user=${context.userId} call=${callId ?? 'unknown'} latencyMs=${Date.now() - startedAt} chars=${completionText.length}`,
      );

      res.write(
        `data: ${JSON.stringify(
          this.buildChatCompletionChunk({
            responseId,
            created,
            model,
            delta: {},
            finishReason: 'stop',
          }),
        )}\n\n`,
      );
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      this.logger.error(
        `vapi.llm.stream.failed session=${context.sessionId} user=${context.userId} call=${callId ?? 'unknown'} error=${(error as Error)?.message ?? error}`,
      );
      if (!res.writableEnded) {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    }
  }

  private collectCustomLlmResponse(
    envelope: WsEnvelope<ConversationStartPayload>,
  ): Promise<{ fullText: string; hangupReason?: string }> {
    const stream$ = this.conversationOrchestration.stream(envelope);

    return new Promise((resolve, reject) => {
      let fullText = '';
      let completedText: string | undefined;
      let hangupReason: string | undefined;

      const subscription = stream$.subscribe({
        next: (event: ConversationStreamEvent) => {
          if (event.type === 'delta' && event.data.delta) {
            fullText += event.data.delta;
            return;
          }

          if (event.type === 'completed') {
            completedText = event.data.fullText;
            return;
          }

          if (event.type === 'hangup_requested') {
            hangupReason = event.data.reason;
          }
        },
        error: (error) => {
          subscription.unsubscribe();
          reject(error instanceof Error ? error : new Error(String(error)));
        },
        complete: () => {
          resolve({
            fullText: completedText ?? fullText,
            ...(hangupReason ? { hangupReason } : {}),
          });
        },
      });
    });
  }

  private async requestPhoneHangup(
    sessionId: string,
    userId: string,
    reason: string,
  ): Promise<void> {
    try {
      await this.phoneCallService.endActiveCall({
        sessionId,
        userId,
        reason,
      });
      await this.endSessionIfNeeded(
        sessionId,
        userId,
        'phone_call_completed:assistant-ended-call',
      );
    } catch (error) {
      this.logger.warn(
        `vapi.llm.hangup_failed session=${sessionId} user=${userId} reason=${reason} error=${(error as Error)?.message ?? error}`,
      );
    }
  }

  private logPitchModelResponse(input: {
    sessionId: string;
    userId: string;
    callId?: string;
    requestId: string;
    model: string;
    text: string;
    hangupReason?: string;
  }): void {
    this.logger.log(
      `pitch.phone.model.response session=${input.sessionId} user=${input.userId} call=${input.callId ?? 'unknown'} request=${input.requestId} model=${input.model} hangup=${input.hangupReason ? 'true' : 'false'} text="${this.previewText(input.text, 500)}"`,
    );
  }

  private buildChatCompletionResponse(input: {
    requestId: string;
    model: string;
    content: string;
  }): Record<string, unknown> {
    const created = Math.floor(Date.now() / 1000);

    return {
      id: `chatcmpl_${input.requestId}`,
      object: 'chat.completion',
      created,
      model: input.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: input.content,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };
  }

  private buildChatCompletionChunk(input: {
    responseId: string;
    created: number;
    model: string;
    delta: Record<string, unknown>;
    finishReason?: string | null;
  }): Record<string, unknown> {
    return {
      id: input.responseId,
      object: 'chat.completion.chunk',
      created: input.created,
      model: input.model,
      choices: [
        {
          index: 0,
          delta: input.delta,
          finish_reason: input.finishReason ?? null,
        },
      ],
    };
  }

  private isTerminalStatus(status: string | undefined): boolean {
    return (
      status === 'ended' ||
      status === 'failed' ||
      status === 'busy' ||
      status === 'no-answer' ||
      status === 'canceled'
    );
  }

  private buildStatusEndReason(
    status: string | undefined,
    endedReason: string | undefined,
  ): string {
    const normalizedStatus = status ?? 'unknown';
    const normalizedReason = endedReason?.trim();

    if (normalizedStatus === 'ended') {
      return `phone_call_completed:${normalizedReason ?? normalizedStatus}`;
    }

    return normalizedReason
      ? `phone_call_terminated:${normalizedStatus}:${normalizedReason}`
      : `phone_call_terminated:${normalizedStatus}`;
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

  private extractMonitorUrl(
    message: Record<string, unknown>,
    key: 'controlUrl' | 'listenUrl',
  ): string | undefined {
    const call = message.call;
    if (!call || typeof call !== 'object') {
      return undefined;
    }

    const callRecord = call as Record<string, unknown>;
    const monitor = callRecord.monitor;
    if (!monitor || typeof monitor !== 'object') {
      return undefined;
    }

    return this.readString(monitor as Record<string, unknown>, key);
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

  private resolveChatCompletionModel(
    payload: VapiChatCompletionRequestEnvelope,
  ): string {
    const model = typeof payload.model === 'string' ? payload.model.trim() : '';
    return model.length > 0 ? model : 'pitch-phone-engine';
  }

  private extractLatestUserMessage(
    messages: VapiChatCompletionMessage[],
  ): string | undefined {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message?.role !== 'user') {
        continue;
      }

      const content = this.extractChatMessageContent(message.content);
      if (content) {
        return content;
      }
    }

    return undefined;
  }

  private extractStarterPrompt(
    messages: VapiChatCompletionMessage[],
  ): string | undefined {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message?.role !== 'system') {
        continue;
      }

      const content = this.extractChatMessageContent(message.content);
      if (!content?.startsWith(PHONE_STARTER_PROMPT_PREFIX)) {
        continue;
      }

      const prompt = content.slice(PHONE_STARTER_PROMPT_PREFIX.length).trim();
      if (prompt.length > 0) {
        return prompt;
      }
    }

    return undefined;
  }

  private extractChatMessageContent(content: unknown): string | undefined {
    if (typeof content === 'string' && content.trim().length > 0) {
      return content.trim();
    }

    if (!Array.isArray(content)) {
      return undefined;
    }

    const parts = content
      .flatMap((part) => {
        if (typeof part === 'string') {
          return [part];
        }

        if (!part || typeof part !== 'object') {
          return [];
        }

        const record = part as Record<string, unknown>;
        const directText = this.readString(record, 'text');
        if (directText) {
          return [directText];
        }

        const nestedText = this.readNestedString(record, 'text', 'value');
        if (nestedText) {
          return [nestedText];
        }

        return [];
      })
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    return parts.length > 0 ? parts.join('\n') : undefined;
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
      parsed.pathname = parsed.pathname.replace(
        /(\/simulation\/phone-calls\/vapi\/llm\/)[^/]+$/u,
        '$1[redacted]',
      );
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
