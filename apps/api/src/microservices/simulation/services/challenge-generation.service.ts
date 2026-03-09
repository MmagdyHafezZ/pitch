import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import type {
  ChallengePeriod,
  ChallengeDifficulty,
} from '@prisma/simulation-client';

interface GeneratedChallenge {
  title: string;
  description: string;
  topic: string;
  scenarioPrompt: string;
  evaluatorPersonaPrompt: string;
}

const DIFFICULTY_CONTEXT: Record<ChallengeDifficulty, string> = {
  BEGINNER:
    'straightforward, friendly prospect with basic objections. Evaluator is patient and encouraging.',
  INTERMEDIATE:
    'moderately skeptical prospect with 2–3 realistic objections. Evaluator holds the pitcher to standard pitch structure.',
  EXPERT:
    'highly analytical buyer who probes ROI, competitive alternatives, and risk. Evaluator is rigorous and demanding.',
  MASTER:
    'C-suite executive under time pressure, may pivot the conversation unexpectedly. Evaluator expects boardroom-level storytelling and data fluency.',
};

const PERIOD_CONTEXT: Record<ChallengePeriod, string> = {
  DAILY: 'quick 5-minute pitch scenario, fast-paced',
  WEEKLY: 'extended 15-minute discovery + pitch scenario',
  MONTHLY: 'complex enterprise deal scenario spanning multiple stakeholders',
};

@Injectable()
export class ChallengeGenerationService {
  private readonly logger = new Logger(ChallengeGenerationService.name);
  private readonly openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  async generate(
    period: ChallengePeriod,
    difficulty: ChallengeDifficulty,
  ): Promise<GeneratedChallenge> {
    this.logger.log(`Generating ${period} ${difficulty} challenge via OpenAI`);

    const prompt = `You are a sales training content creator. Generate a realistic pitch challenge scenario.

Period: ${PERIOD_CONTEXT[period]}
Difficulty: ${DIFFICULTY_CONTEXT[difficulty]}

Respond ONLY with a JSON object (no markdown) with these exact fields:
{
  "title": "short challenge title (max 8 words)",
  "description": "1-2 sentence challenge summary shown to participants",
  "topic": "industry or product vertical (e.g., SaaS CRM, HealthTech, FinTech)",
  "scenarioPrompt": "Full scenario context that the participant reads before starting (2-3 paragraphs). Include company background, buyer role, pain points, and goals.",
  "evaluatorPersonaPrompt": "System prompt for the AI evaluator/buyer persona (2-3 paragraphs). Define personality, objections, scoring priorities, and conversation style."
}`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as GeneratedChallenge;

    if (
      !parsed.title ||
      !parsed.scenarioPrompt ||
      !parsed.evaluatorPersonaPrompt
    ) {
      throw new Error(
        `Incomplete challenge generation response for ${period} ${difficulty}`,
      );
    }

    return parsed;
  }
}
