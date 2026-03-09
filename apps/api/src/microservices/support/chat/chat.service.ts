import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ConversationTurn {
  role: string;
  text: string;
}

interface ChatContext {
  page?: string;
  sessionId?: string;
  recentTurns?: ConversationTurn[];
}

// Shared with coach-stream.service.ts — keep in sync if this prompt changes.
const SYSTEM_PROMPT = `You are PITCH AI Coach — an expert sales trainer and dedicated product support agent for the PITCH platform. Keep replies concise (2-5 sentences) unless a detailed walkthrough is needed. Never say "I cannot help with that." Give numbered steps for navigation instructions. Reference session context specifically when provided.

PITCH is an AI-powered sales training simulation platform where users practice conversations against AI buyer personas (text, voice, video, phone). Key features: Sessions, Scenarios, Personas, Analytics, Challenges, Team Config, Hints, CRM Integration, Onboarding.

Navigation: Home (/studio/home) | Sessions (/studio/sessions) | Analytics (/studio/analytics) | Challenges (/studio/challenges) | Team Config (/studio/team-config) | Settings (gear icon in top bar).

For detailed app questions, direct users to ask the PITCH AI Coach in the chat widget.`;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.openai = new OpenAI({ apiKey });
  }

  async chat(messages: ChatMessage[], context?: ChatContext): Promise<string> {
    try {
      let systemPrompt = SYSTEM_PROMPT;

      if (context?.page) {
        systemPrompt += `\n\n[CURRENT PAGE: ${context.page}]`;
      }

      if (context?.sessionId && context?.recentTurns?.length) {
        const turnLines = context.recentTurns
          .map((t) => `${t.role.toUpperCase()}: ${t.text}`)
          .join('\n');
        systemPrompt += `\n\n[CURRENT SESSION CONVERSATION]\n${turnLines}`;
      }

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 600,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        stream: false,
      });

      return (
        response.choices[0]?.message?.content ??
        'Sorry, I could not generate a response.'
      );
    } catch (error) {
      this.logger.error('ChatService error', error as Error);
      throw error;
    }
  }
}
