import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subscription } from 'rxjs';
import { randomUUID } from 'crypto';
import { LLMProviderRegistry } from '../../providers/llm/llm-provider.registry';
import {
  LLMRequestDto,
  LLMResponseDto,
  LLMStreamChunkDto,
  LLMMessageDto,
  LLMUsageDto,
} from '../../dto/llm.dto';
import { UsageCalculatorService } from './usage-calculator.service';
import { SimulationPrismaService } from '../../prisma/simulation-prisma.service';
import { MongoConnectionService } from '../mongo/mongo-connection.service';
import {
  LLMTraceModel,
  LLMTraceSchema,
  type ILLMMessage,
  type ILLMTrace,
} from '../../schemas/mongodb';

interface LLMRequestContext {
  requestId?: string;
  userId?: string;
  orgId?: string;
  purpose?: 'chat' | 'tool_call' | 'evaluation' | 'enrichment' | 'other';
  traceId?: string;
}

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);
  private readonly activeStreams = new Map<string, Subscription>();

  constructor(
    private readonly providerRegistry: LLMProviderRegistry,
    private readonly usageCalculator: UsageCalculatorService,
    private readonly prisma: SimulationPrismaService,
    private readonly mongo: MongoConnectionService,
  ) {}

  async complete(
    request: LLMRequestDto,
    context?: LLMRequestContext,
  ): Promise<LLMResponseDto> {
    const provider = this.providerRegistry.getProviderForModel(
      request.config.model,
      request.config.provider,
    );
    provider.validateConfig(request.config);

    const startedAt = Date.now();
    try {
      const response = await provider.complete(
        request.messages,
        request.config,
      );
      const latencyMs = Date.now() - startedAt;

      const usage = this.usageCalculator.normalizeUsage({
        messages: request.messages,
        responseText: response.content,
        model: request.config.model,
        providerName: provider.name,
        providerUsage: response.usage,
      });

      response.usage = usage;

      await this.persistMetric(request, usage, latencyMs, provider.name);
      await this.persistTrace(
        request,
        response,
        usage,
        latencyMs,
        provider.name,
        context,
      );

      return response;
    } catch (error) {
      await this.persistErrorTrace(
        request,
        provider.name,
        error,
        context,
        Date.now() - startedAt,
      );
      throw error;
    }
  }

  stream(
    request: LLMRequestDto,
    context?: LLMRequestContext,
  ): Observable<LLMStreamChunkDto> {
    const provider = this.providerRegistry.getProviderForModel(
      request.config.model,
      request.config.provider,
    );
    provider.validateConfig(request.config);

    const startedAt = Date.now();
    let content = '';
    let timeToFirstTokenMs: number | null = null;

    return new Observable((subscriber) => {
      const subscription = provider
        .stream(request.messages, request.config)
        .subscribe({
          next: async (chunk) => {
            if (chunk.delta) {
              content += chunk.delta;
              if (timeToFirstTokenMs === null) {
                timeToFirstTokenMs = Date.now() - startedAt;
              }
            }

            if (chunk.done) {
              const latencyMs = Date.now() - startedAt;
              const usage = this.usageCalculator.normalizeUsage({
                messages: request.messages,
                responseText: content,
                model: request.config.model,
                providerName: provider.name,
                providerUsage: chunk.usage,
              });

              chunk.usage = usage;

              await this.persistMetric(
                request,
                usage,
                latencyMs,
                provider.name,
              );
              await this.persistTrace(
                request,
                {
                  content,
                  usage,
                  providerMeta: {
                    latencyMs,
                    model: request.config.model,
                    finishReason: chunk.finishReason,
                  },
                },
                usage,
                latencyMs,
                provider.name,
                context,
                timeToFirstTokenMs,
              );

              subscriber.next(chunk);
              subscriber.complete();
              return;
            }

            subscriber.next(chunk);
          },
          error: async (error) => {
            await this.persistErrorTrace(
              request,
              provider.name,
              error,
              context,
              Date.now() - startedAt,
            );
            subscriber.error(error);
          },
          complete: () => {
            if (!subscriber.closed) {
              subscriber.complete();
            }
          },
        });

      if (context?.requestId) {
        this.activeStreams.set(context.requestId, subscription);
      }

      return () => {
        if (context?.requestId) {
          this.activeStreams.delete(context.requestId);
        }
        subscription.unsubscribe();
      };
    });
  }

  cancel(requestId: string): boolean {
    const subscription = this.activeStreams.get(requestId);
    if (!subscription) {
      return false;
    }

    subscription.unsubscribe();
    this.activeStreams.delete(requestId);
    return true;
  }

  private async persistMetric(
    request: LLMRequestDto,
    usage: LLMUsageDto,
    latencyMs: number,
    providerName: string,
  ): Promise<void> {
    try {
      await this.prisma.metric.create({
        data: {
          sessionId: request.sessionId,
          tokensInput: usage.promptTokens,
          tokensOutput: usage.completionTokens,
          latencyMs,
          costUsd: usage.costUsd,
          model: `${providerName}:${request.config.model}`,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to persist metric: ${String((error as Error)?.message || error)}`,
      );
    }
  }

  private async persistTrace(
    request: LLMRequestDto,
    response: LLMResponseDto,
    usage: LLMUsageDto,
    latencyMs: number,
    providerName: string,
    context?: LLMRequestContext,
    timeToFirstTokenMs?: number | null,
  ): Promise<void> {
    if (!this.mongo.isConnected()) {
      return;
    }

    try {
      const model = this.mongo.getModel<ILLMTrace>(
        LLMTraceModel,
        LLMTraceSchema,
      );

      const trace = new model({
        _id: randomUUID(),
        sessionId: request.sessionId,
        turnId: request.turnId,
        provider: providerName,
        llmModel: request.config.model,
        request: {
          messages: this.convertMessages(request.messages),
          temperature: request.config.temperature,
          maxTokens: request.config.maxTokens,
          topP: request.config.topP,
          frequencyPenalty: request.config.frequencyPenalty,
          presencePenalty: request.config.presencePenalty,
          stop: request.config.stop,
          stream: request.config.stream,
          tools: request.config.tools,
          toolChoice: request.config.toolChoice,
        },
        response: {
          content: response.content,
          finishReason: response.providerMeta?.finishReason,
          toolCalls: response.toolCalls?.map((tool) => ({
            id: tool.id,
            type: 'function',
            function: {
              name: tool.name,
              arguments: tool.arguments,
            },
          })),
        },
        usage: {
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
          cost: usage.costUsd,
        },
        performance: {
          latencyMs,
          timeToFirstTokenMs: timeToFirstTokenMs ?? undefined,
          requestId: response.providerMeta?.requestId,
        },
        context: context
          ? {
              userId: context.userId,
              orgId: context.orgId,
              traceId: context.traceId,
              purpose: context.purpose,
            }
          : undefined,
        error: {
          occurred: false,
        },
      });

      await trace.save();
    } catch (error) {
      this.logger.warn(
        `Failed to persist LLM trace: ${String((error as Error)?.message || error)}`,
      );
    }
  }

  private async persistErrorTrace(
    request: LLMRequestDto,
    providerName: string,
    error: unknown,
    context?: LLMRequestContext,
    latencyMs?: number,
  ): Promise<void> {
    if (!this.mongo.isConnected()) {
      return;
    }

    try {
      const model = this.mongo.getModel<ILLMTrace>(
        LLMTraceModel,
        LLMTraceSchema,
      );
      const message = (error as Error)?.message || String(error);

      const trace = new model({
        _id: randomUUID(),
        sessionId: request.sessionId,
        turnId: request.turnId,
        provider: providerName,
        llmModel: request.config.model,
        request: {
          messages: this.convertMessages(request.messages),
          temperature: request.config.temperature,
          maxTokens: request.config.maxTokens,
          topP: request.config.topP,
          frequencyPenalty: request.config.frequencyPenalty,
          presencePenalty: request.config.presencePenalty,
          stop: request.config.stop,
          stream: request.config.stream,
          tools: request.config.tools,
          toolChoice: request.config.toolChoice,
        },
        response: {},
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
        performance: {
          latencyMs: latencyMs ?? 0,
        },
        context: context
          ? {
              userId: context.userId,
              orgId: context.orgId,
              traceId: context.traceId,
              purpose: context.purpose,
            }
          : undefined,
        error: {
          occurred: true,
          message,
        },
      });

      await trace.save();
    } catch (traceError) {
      this.logger.warn(
        `Failed to persist LLM error trace: ${String(
          (traceError as Error)?.message || traceError,
        )}`,
      );
    }
  }

  private convertMessages(messages: LLMMessageDto[]): ILLMMessage[] {
    return messages.map((message) => ({
      role: message.role,
      content: this.stringifyContent(message.content),
      name: message.name,
      toolCallId: message.toolCallId,
    }));
  }

  private stringifyContent(
    content?: string | Array<{ type: string; [key: string]: any }>,
  ): string {
    if (!content) return '';
    if (typeof content === 'string') return content;

    return content
      .map((part) => {
        if (part.type === 'text') return part.text || '';
        if (part.type === 'image') return `[image:${part.url || 'unknown'}]`;
        if (part.type === 'audio') return `[audio:${part.url || 'unknown'}]`;
        return '';
      })
      .join(' ')
      .trim();
  }
}
