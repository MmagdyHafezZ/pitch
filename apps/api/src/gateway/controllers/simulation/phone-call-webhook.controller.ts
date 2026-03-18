import {
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
import { randomUUID } from 'crypto';
import { Public } from '../../../microservices/userManagement/decorators/public.decorator';
import { VapiContextService } from '@microservices/simulation/phone/vapi-context.service';
import {
  PhoneConversationEngineService,
  type PhoneConversationResult,
} from '@microservices/simulation/services/phone-conversation-engine.service';
import { SessionService } from '@microservices/simulation/services/session.service';

interface OpenAIChatMessage {
  role: string;
  content?:
    | string
    | Array<{
        type?: string;
        text?: string;
        content?: string;
        inputText?: string;
        input_text?: string;
        value?: string;
      }>;
}

interface OpenAIChatCompletionRequest {
  model?: string;
  messages?: OpenAIChatMessage[];
  stream?: boolean;
}

interface VapiServerEnvelope {
  message?: {
    type?: string;
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
    private readonly phoneConversationEngine: PhoneConversationEngineService,
    private readonly sessionService: SessionService,
  ) {}

  @Post('vapi/llm/chat/completions')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Custom LLM endpoint used by Vapi phone calls' })
  async handleVapiCustomLlm(
    @Query('token') token: string,
    @Body() body: OpenAIChatCompletionRequest,
    @Res() res: Response,
  ) {
    const context = this.vapiContext.verifyToken(token);
    const model = body.model ?? 'pitch-phone-engine';
    const messages = body.messages ?? [];
    const latestUserText = this.getLatestUserText(messages);
    const startAsAssistant = !this.hasUserMessage(messages);
    const inputMode = startAsAssistant
      ? 'assistant_start'
      : this.classifyUserInput(latestUserText);

    this.logger.log(
      `vapi.llm.request session=${context.sessionId} user=${context.userId} startAsAssistant=${startAsAssistant} inputMode=${inputMode} messageCount=${messages.length} text="${this.preview(latestUserText)}"`,
    );

    try {
      const nonSpeechResult = this.buildNonSpeechTurnResult(inputMode);
      if (nonSpeechResult) {
        this.logger.log(
          `vapi.llm.non_speech session=${context.sessionId} user=${context.userId} inputMode=${inputMode}`,
        );

        if (body.stream === true) {
          this.writeStreamingCompletion(res, model, nonSpeechResult);
          return;
        }

        res.json(this.buildCompletion(model, nonSpeechResult));
        return;
      }

      const result = await this.phoneConversationEngine.generateTurn({
        sessionId: context.sessionId,
        userId: context.userId,
        text: latestUserText,
        startAsAssistant,
      });

      this.logConversationResult(context.sessionId, context.userId, result);

      if (body.stream === true) {
        this.writeStreamingCompletion(res, model, result);
        return;
      }

      res.json(this.buildCompletion(model, result));
    } catch (error) {
      this.logger.error(
        `vapi.llm.error session=${context.sessionId} user=${context.userId}`,
        error,
      );

      const fallback = this.buildEmergencyEndCallResult();
      if (body.stream === true) {
        this.writeStreamingCompletion(res, model, fallback);
        return;
      }

      res.json(this.buildCompletion(model, fallback));
    }
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

    switch (type) {
      case 'status-update': {
        const status = this.extractStatus(message);
        this.logger.log(
          `vapi.event.status session=${context.sessionId} user=${context.userId} status=${status ?? 'unknown'} payload=${this.safeJson(message)}`,
        );
        if (status === 'connected' || status === 'in-progress') {
          this.logger.log(
            `vapi.event.connected session=${context.sessionId} user=${context.userId} status=${status}`,
          );
        }
        if (
          status === 'failed' ||
          status === 'busy' ||
          status === 'no-answer' ||
          status === 'canceled'
        ) {
          this.logger.warn(
            `vapi.event.failure session=${context.sessionId} user=${context.userId} status=${status} payload=${this.safeJson(message)}`,
          );
        }
        break;
      }
      case 'speech-update':
        this.logger.log(
          `vapi.event.speech session=${context.sessionId} user=${context.userId} payload=${this.safeJson(message)}`,
        );
        break;
      case 'transcript':
        this.logger.log(
          `vapi.event.transcript session=${context.sessionId} user=${context.userId} payload=${this.safeJson(message)}`,
        );
        break;
      case 'conversation-update':
        this.logger.log(
          `vapi.event.conversation session=${context.sessionId} user=${context.userId} payload=${this.safeJson(message)}`,
        );
        break;
      case 'model-output':
        this.logger.log(
          `vapi.event.model_output session=${context.sessionId} user=${context.userId} payload=${this.safeJson(message)}`,
        );
        break;
      case 'tool-calls':
        this.logger.log(
          `vapi.event.tool_calls session=${context.sessionId} user=${context.userId} payload=${this.safeJson(message)}`,
        );
        break;
      case 'end-of-call-report': {
        const reason = this.extractEndReason(message);
        this.logger.log(
          `vapi.event.end_of_call session=${context.sessionId} user=${context.userId} reason=${reason} payload=${this.safeJson(message)}`,
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
          `vapi.event.hang session=${context.sessionId} user=${context.userId} payload=${this.safeJson(message)}`,
        );
        await this.endSessionIfNeeded(
          context.sessionId,
          context.userId,
          'phone_call_hang',
        );
        break;
      default:
        this.logger.log(
          `vapi.event.ignored session=${context.sessionId} user=${context.userId} type=${type} payload=${this.safeJson(message)}`,
        );
        break;
    }

    return { ok: true };
  }

  private getLatestUserText(messages: OpenAIChatMessage[]): string {
    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === 'user');

    if (!latestUserMessage?.content) {
      return '';
    }

    if (typeof latestUserMessage.content === 'string') {
      return latestUserMessage.content.trim();
    }

    return latestUserMessage.content
      .map(
        (part) =>
          part.text ??
          part.content ??
          part.inputText ??
          part.input_text ??
          part.value ??
          '',
      )
      .join(' ')
      .trim();
  }

  private hasUserMessage(messages: OpenAIChatMessage[]): boolean {
    return messages.some((message) => message.role === 'user');
  }

  private classifyUserInput(text: string): 'spoken' | 'empty' | 'dtmf_digits' {
    const normalized = text.trim();
    if (!normalized) {
      return 'empty';
    }

    if (/^[0-9#*]{1,2}$/.test(normalized)) {
      return 'dtmf_digits';
    }

    return 'spoken';
  }

  private buildNonSpeechTurnResult(
    inputMode: 'assistant_start' | 'spoken' | 'empty' | 'dtmf_digits',
  ): PhoneConversationResult | null {
    if (inputMode === 'empty') {
      return {
        text: 'I did not catch that. Say that again and we can keep going.',
        hangupRequested: false,
        toolEvents: [],
      };
    }

    if (inputMode === 'dtmf_digits') {
      return {
        text: 'No need to press any keys. Just talk to me naturally and we can keep the conversation going.',
        hangupRequested: false,
        toolEvents: [],
      };
    }

    return null;
  }

  private buildCompletion(model: string, result: PhoneConversationResult) {
    const toolCalls = result.hangupRequested
      ? [
          {
            id: `call_${randomUUID()}`,
            type: 'function',
            function: {
              name: 'endCall',
              arguments: JSON.stringify({
                reason: result.hangupReason ?? 'conversation_completed',
              }),
            },
          },
        ]
      : undefined;

    return {
      id: `chatcmpl_${randomUUID()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: result.text,
            ...(toolCalls ? { tool_calls: toolCalls } : {}),
          },
          finish_reason: toolCalls ? 'tool_calls' : 'stop',
        },
      ],
    };
  }

  private writeStreamingCompletion(
    res: Response,
    model: string,
    result: PhoneConversationResult,
  ) {
    const created = Math.floor(Date.now() / 1000);
    const completionId = `chatcmpl_${randomUUID()}`;

    res.status(HttpStatus.OK);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const contentChunk = {
      id: completionId,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [
        {
          index: 0,
          delta: {
            role: 'assistant',
            ...(result.text ? { content: result.text } : {}),
          },
          finish_reason: null,
        },
      ],
    };
    res.write(`data: ${JSON.stringify(contentChunk)}\n\n`);

    if (result.hangupRequested) {
      const toolChunk = {
        id: completionId,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: `call_${randomUUID()}`,
                  type: 'function',
                  function: {
                    name: 'endCall',
                    arguments: JSON.stringify({
                      reason: result.hangupReason ?? 'conversation_completed',
                    }),
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      };
      res.write(`data: ${JSON.stringify(toolChunk)}\n\n`);
    }

    const doneChunk = {
      id: completionId,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: result.hangupRequested ? 'tool_calls' : 'stop',
        },
      ],
    };
    res.write(`data: ${JSON.stringify(doneChunk)}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }

  private buildEmergencyEndCallResult(): PhoneConversationResult {
    return {
      text: 'I am sorry, something went wrong and I need to end the call now.',
      hangupRequested: true,
      hangupReason: 'backend_error',
      toolEvents: [],
    };
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

  private extractEndReason(message: Record<string, unknown>): string {
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

    return endedReason ?? 'unknown';
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

  private readString(
    source: Record<string, unknown>,
    key: string,
  ): string | undefined {
    const value = source[key];
    return typeof value === 'string' && value.trim().length > 0
      ? value
      : undefined;
  }

  private safeJson(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch {
      return '[unserializable]';
    }
  }

  private preview(value: string): string {
    if (value.length <= 120) {
      return value;
    }

    return `${value.slice(0, 117)}...`;
  }

  private logConversationResult(
    sessionId: string,
    userId: string,
    result: PhoneConversationResult,
  ) {
    this.logger.log(
      `vapi.llm.response session=${sessionId} user=${userId} hangup=${result.hangupRequested} text="${this.preview(result.text)}"`,
    );

    for (const toolEvent of result.toolEvents) {
      this.logger.log(
        `vapi.llm.tool session=${sessionId} user=${userId} tool=${toolEvent.tool} args=${this.safeJson(toolEvent.args)}`,
      );
    }

    if (result.hangupRequested) {
      this.logger.log(
        `vapi.llm.hangup session=${sessionId} user=${userId} reason=${result.hangupReason ?? 'conversation_completed'}`,
      );
    }
  }
}
