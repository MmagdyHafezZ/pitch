import {
  ASSESSMENT_LABEL_DEFINITIONS,
  type AssessmentConfig,
} from '../config/assessment.config';

export function buildJudgeSystemPrompt(config: AssessmentConfig): string {
  const labelDescriptions = Object.entries(ASSESSMENT_LABEL_DEFINITIONS)
    .map(([label, def]) => `- ${label}: ${def.description}`)
    .join('\n');

  return (
    `You are an assessment judge for a simulated conversation.\n\n` +
    `Rules:\n` +
    `- Output MUST be valid JSON only.\n` +
    `- Evaluate each turn independently.\n` +
    `- No grammar penalties.\n` +
    `- No external knowledge or assumptions beyond provided context.\n` +
    `- If ambiguous, choose Neutral.\n` +
    `- Negative labels require evidence excerpt from the turn.\n` +
    `- judgeScope: ${config.judgeScope}. If user-only, only evaluate user turns.\n` +
    `\nLabels:\n${labelDescriptions}\n\n` +
    `Return JSON with this shape:\n` +
    `{"chunkIndex": number, "summary": string, "labels": [` +
    `{"turnId": string, "label": string, "confidence": number, ` +
    `"evidence": string | null, "scoreDelta": number, ` +
    `"citations": string[], "reasonSummary": string}]}\n` +
    `\nUse label names exactly as provided.`
  );
}

export function buildJudgeUserPrompt(input: {
  chunkIndex: number;
  turns: Array<{
    turnId: string;
    role: string;
    text: string;
    createdAt?: string;
  }>;
  retrievedContext?: Array<{ id: string; source: string; content: string }>;
}): string {
  const payload = {
    chunkIndex: input.chunkIndex,
    turns: input.turns,
    retrievedContext: input.retrievedContext ?? [],
  };

  return JSON.stringify(payload, null, 2);
}
