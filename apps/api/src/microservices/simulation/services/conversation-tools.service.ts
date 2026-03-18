import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import type { Prisma } from '@prisma/simulation-client';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';
import { SimulationRedisService } from './redis/redis.service';
import type { LLMToolDto, LLMToolCallDto } from '../dto/llm.dto';
import type { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { CRM_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import type { CalendarEvent } from '@microservices/crm/services/google-calendar-integration.service';

export interface IMoodState {
  mood:
    | 'neutral'
    | 'interested'
    | 'skeptical'
    | 'impatient'
    | 'frustrated'
    | 'satisfied';
  intensity: number;
  trigger: string;
  setAt: string;
}

export interface ToolEffect {
  tool: string;
  args: Record<string, unknown>;
  streamEventOverride?: 'hangup_requested';
}

export interface ToolContext {
  sessionId: string;
  iterationId: string;
  turnId?: string;
  userId?: string;
}

@Injectable()
export class ConversationToolsService {
  private readonly logger = new Logger(ConversationToolsService.name);

  constructor(
    private readonly prisma: SimulationPrismaService,
    private readonly redis: SimulationRedisService,
    @Optional()
    @Inject('CRM_SERVICE')
    private readonly crmClient: ClientProxy | null,
  ) {}

  getToolDefinitions(): LLMToolDto[] {
    return [
      {
        type: 'function',
        function: {
          name: 'end_call',
          description:
            'Signal that the conversation has naturally concluded. Use only when the exchange is genuinely finished — both parties have said goodbye, or further dialogue serves no purpose.',
          parameters: {
            type: 'object',
            properties: {
              reason: {
                type: 'string',
                description: 'One-sentence reason the call is ending.',
              },
            },
            required: ['reason'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'raise_objection',
          description:
            'Register a formal objection to what the user has said. Use when you have a meaningful concern about the proposal, pricing, timeline, or fit.',
          parameters: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: [
                  'price',
                  'timeline',
                  'trust',
                  'fit',
                  'authority',
                  'need',
                  'other',
                ],
                description: 'Category of the objection.',
              },
              text: {
                type: 'string',
                description: 'The objection text as you would say it.',
              },
            },
            required: ['type', 'text'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'update_mood',
          description:
            'Update your current emotional state. Call this when your mood shifts meaningfully based on how the conversation is going. This will carry over into future turns.',
          parameters: {
            type: 'object',
            properties: {
              mood: {
                type: 'string',
                enum: [
                  'neutral',
                  'interested',
                  'skeptical',
                  'impatient',
                  'frustrated',
                  'satisfied',
                ],
                description: 'Your current emotional state.',
              },
              intensity: {
                type: 'number',
                minimum: 1,
                maximum: 10,
                description:
                  'How strongly you feel this (1 = mild, 10 = extreme).',
              },
              trigger: {
                type: 'string',
                description: 'Brief description of what caused the mood shift.',
              },
            },
            required: ['mood', 'intensity', 'trigger'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'flag_moment',
          description:
            'Flag a notable coaching moment in the conversation — a key insight, missed opportunity, or excellent technique.',
          parameters: {
            type: 'object',
            properties: {
              moment_type: {
                type: 'string',
                enum: [
                  'excellent_technique',
                  'missed_opportunity',
                  'key_insight',
                  'objection_handled',
                  'rapport_built',
                ],
                description: 'Type of coaching moment.',
              },
              description: {
                type: 'string',
                description: 'What happened and why it matters.',
              },
            },
            required: ['moment_type', 'description'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'propose_next_step',
          description:
            'Propose a concrete next step to advance the deal. Use when the conversation has reached a natural point to move forward.',
          parameters: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                description:
                  'The specific next step (e.g. "Schedule a product demo", "Send a proposal").',
              },
              timeframe: {
                type: 'string',
                description:
                  'When this should happen (e.g. "next week", "by end of month").',
              },
            },
            required: ['action', 'timeframe'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'request_clarification',
          description:
            'Record that you need clarification on a specific topic. Use for tracking what the user has and has not addressed.',
          parameters: {
            type: 'object',
            properties: {
              topic: {
                type: 'string',
                description: 'The topic requiring clarification.',
              },
              question: {
                type: 'string',
                description: 'The specific question you are asking.',
              },
            },
            required: ['topic', 'question'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_calendar_events',
          description:
            "Retrieve the user's upcoming calendar events to help them prepare for meetings. Use when the user asks about their schedule, upcoming meetings, or wants to prepare for a specific meeting.",
          parameters: {
            type: 'object',
            properties: {
              look_ahead_days: {
                type: 'number',
                minimum: 1,
                maximum: 30,
                description:
                  'Number of days ahead to look for events (default: 7).',
              },
            },
            required: [],
          },
        },
      },
    ];
  }

  async execute(
    calls: LLMToolCallDto[],
    context: ToolContext,
  ): Promise<ToolEffect[]> {
    const effects: ToolEffect[] = [];

    for (const call of calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.arguments) as Record<string, unknown>;
      } catch {
        this.logger.warn(
          `Failed to parse arguments for tool ${call.name}: ${call.arguments}`,
        );
        continue;
      }

      const startTime = Date.now();
      let success = false;
      const effect: ToolEffect = { tool: call.name, args };

      try {
        switch (call.name) {
          case 'end_call':
            this.executeEndCall(args, context);
            effect.streamEventOverride = 'hangup_requested';
            break;
          case 'raise_objection':
            this.executeRaiseObjection(args, context);
            break;
          case 'update_mood':
            await this.executeUpdateMood(args, context);
            break;
          case 'flag_moment':
            this.executeFlagMoment(args, context);
            break;
          case 'propose_next_step':
            this.executeProposeNextStep(args, context);
            break;
          case 'request_clarification':
            this.executeRequestClarification(args, context);
            break;
          case 'get_calendar_events':
            await this.executeGetCalendarEvents(args, context);
            break;
          default:
            this.logger.warn(`Unknown tool: ${call.name}`);
            continue;
        }
        success = true;
        effects.push(effect);
      } catch (err) {
        this.logger.warn(
          `Tool ${call.name} execution failed: ${(err as Error)?.message ?? err}`,
        );
      }

      const latencyMs = Date.now() - startTime;
      this.persistToolCall(call, args, context, latencyMs, success);
    }

    return effects;
  }

  private executeEndCall(
    args: Record<string, unknown>,
    _context: ToolContext,
  ): void {
    this.logger.log(`end_call triggered: ${String(args.reason)}`);
  }

  private executeRaiseObjection(
    args: Record<string, unknown>,
    _context: ToolContext,
  ): void {
    this.logger.log(
      `raise_objection [${String(args.type)}]: ${String(args.text)}`,
    );
  }

  private async executeUpdateMood(
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<void> {
    const moodState: IMoodState = {
      mood: args.mood as IMoodState['mood'],
      intensity: Number(args.intensity),
      trigger: String(args.trigger),
      setAt: new Date().toISOString(),
    };
    await this.redis.setMoodState(context.sessionId, moodState);
    this.logger.log(
      `update_mood [${moodState.mood} @ ${moodState.intensity}]: ${moodState.trigger}`,
    );
  }

  private executeFlagMoment(
    args: Record<string, unknown>,
    _context: ToolContext,
  ): void {
    this.logger.log(
      `flag_moment [${String(args.moment_type)}]: ${String(args.description)}`,
    );
  }

  private executeProposeNextStep(
    args: Record<string, unknown>,
    _context: ToolContext,
  ): void {
    this.logger.log(
      `propose_next_step: ${String(args.action)} by ${String(args.timeframe)}`,
    );
  }

  private executeRequestClarification(
    args: Record<string, unknown>,
    _context: ToolContext,
  ): void {
    this.logger.log(
      `request_clarification [${String(args.topic)}]: ${String(args.question)}`,
    );
  }

  private async executeGetCalendarEvents(
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<CalendarEvent[]> {
    const lookAheadDays = Math.min(
      30,
      Math.max(1, Number(args.look_ahead_days ?? 7)),
    );
    const userId = context.userId;

    if (!userId) {
      this.logger.warn('get_calendar_events: no userId in ToolContext');
      return [];
    }

    if (!this.crmClient) {
      this.logger.warn('get_calendar_events: CRM_SERVICE not injected');
      return [];
    }

    try {
      const events = await firstValueFrom<CalendarEvent[]>(
        this.crmClient
          .send<CalendarEvent[]>(CRM_SERVICE_PATTERNS.CALENDAR_GET_UPCOMING, {
            userId,
            lookAheadDays,
          })
          .pipe(timeout(8000)),
      );
      this.logger.log(
        `get_calendar_events: fetched ${events.length} events for user ${userId}`,
      );
      return events;
    } catch (err) {
      this.logger.warn(
        `get_calendar_events failed: ${(err as Error)?.message ?? err}`,
      );
      return [];
    }
  }

  private persistToolCall(
    call: LLMToolCallDto,
    args: Record<string, unknown>,
    context: ToolContext,
    latencyMs: number,
    success: boolean,
  ): void {
    const input = args as unknown as Prisma.InputJsonValue;

    void this.prisma.client.toolCall
      .create({
        data: {
          iterationId: context.iterationId,
          name: call.name,
          input,
          latencyMs,
          success,
        },
      })
      .catch((err) => {
        this.logger.warn(
          `Failed to persist ToolCall for ${call.name}: ${(err as Error)?.message ?? err}`,
        );
      });
  }
}
