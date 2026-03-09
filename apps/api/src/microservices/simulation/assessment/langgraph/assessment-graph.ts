import { Injectable, Logger } from '@nestjs/common';
import { END, START, StateGraph } from '@langchain/langgraph';
import { RunnableConfig } from '@langchain/core/runnables';
import {
  AssessmentState,
  type AssessmentStateType,
  type AssessmentChunk,
  type ChunkJudgment,
  type NormalizedTurn,
  type AssessmentSummaryResult,
  type AssessmentReportPayload,
  type NodeTiming,
  type RetrievalItem,
} from './assessment-state';
import { AssessmentRepository } from '../repositories/assessment.repository';
import { AssessmentReportRepository } from '../repositories/assessment-report.repository';
import { SimulationPrismaService } from '../../prisma/simulation-prisma.service';
import { LLMService } from '../../services/llm/llm.service';
import {
  buildJudgeSystemPrompt,
  buildJudgeUserPrompt,
} from '../prompts/judge.prompt';
import { JudgeOutputSchema, type JudgeOutput } from './judge-output.schema';
import { AssessmentLabelValue } from '@prisma/simulation-client';
import { computeScore } from '../utils/scoring';
import type { AssessmentConfig } from '../config/assessment.config';
import { RagService } from '../../rag/rag.service';

interface AssessmentGraphResult {
  summary: AssessmentSummaryResult;
  report: AssessmentReportPayload;
  labels: ChunkJudgment['labels'];
  warnings: string[];
  partial: boolean;
  nodeTimings: NodeTiming[];
  reportId?: string;
}

type TimedResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'timeout' }
  | { status: 'error' };

@Injectable()
export class AssessmentGraphRunner {
  private readonly logger = new Logger(AssessmentGraphRunner.name);
  private readonly graph: ReturnType<typeof this.buildGraph>;

  constructor(
    private readonly prisma: SimulationPrismaService,
    private readonly assessmentRepository: AssessmentRepository,
    private readonly assessmentReportRepository: AssessmentReportRepository,
    private readonly llmService: LLMService,
    private readonly ragService: RagService,
  ) {
    this.graph = this.buildGraph();
  }

  async run(
    state: Omit<
      AssessmentStateType,
      | 'turnsRaw'
      | 'turns'
      | 'chunks'
      | 'retrievalByChunk'
      | 'judgments'
      | 'labels'
      | 'summary'
      | 'report'
      | 'warnings'
      | 'partial'
      | 'nodeTimings'
    >,
  ): Promise<AssessmentGraphResult> {
    const result = await this.graph.invoke(
      {
        ...state,
        turnsRaw: [],
        turns: [],
        chunks: [],
        retrievalByChunk: [],
        judgments: [],
        labels: [],
        summary: null,
        report: null,
        warnings: [],
        partial: false,
        nodeTimings: [],
      },
      this.buildRunConfig(state),
    );

    return {
      summary: result.summary ?? { totalScore: 0 },
      report: result.report ?? {
        totalScore: result.summary?.totalScore ?? 0,
        turnAnnotations: [],
      },
      labels: result.labels ?? [],
      warnings: result.warnings ?? [],
      partial: result.partial ?? false,
      nodeTimings: result.nodeTimings ?? [],
      reportId: undefined,
    };
  }

  private buildRunConfig(
    state: Omit<
      AssessmentStateType,
      | 'turnsRaw'
      | 'turns'
      | 'chunks'
      | 'retrievalByChunk'
      | 'judgments'
      | 'labels'
      | 'summary'
      | 'report'
      | 'warnings'
      | 'partial'
      | 'nodeTimings'
    >,
  ): RunnableConfig {
    return {
      tags: ['assessment', state.mode, state.configVersion],
      metadata: {
        runId: state.runId,
        mode: state.mode,
        configVersion: state.configVersion,
      },
    } satisfies RunnableConfig;
  }

  private buildGraph() {
    const graph = new StateGraph(AssessmentState);

    graph.addNode(
      'loadSessionData',
      this.wrapTiming('loadSessionData', this.loadSessionData),
    );
    graph.addNode(
      'normalizeTurns',
      this.wrapTiming('normalizeTurns', this.normalizeTurns),
    );
    graph.addNode(
      'chunkConversation',
      this.wrapTiming('chunkConversation', this.chunkConversation),
    );
    graph.addNode(
      'retrieveContext',
      this.wrapTiming('retrieveContext', this.retrieveContext),
    );
    graph.addNode(
      'judgeChunks',
      this.wrapTiming('judgeChunks', this.judgeChunks),
    );
    graph.addNode(
      'reduceMerge',
      this.wrapTiming('reduceMerge', this.reduceMerge),
    );
    graph.addNode(
      'finalizeScores',
      this.wrapTiming('finalizeScores', this.finalizeScores),
    );
    graph.addNode(
      'persistResults',
      this.wrapTiming('persistResults', this.persistResults),
    );

    // @ts-expect-error - LangGraph type definitions are overly strict
    graph.addEdge(START, 'loadSessionData');
    // @ts-expect-error - LangGraph type definitions are overly strict
    graph.addEdge('loadSessionData', 'normalizeTurns');
    // @ts-expect-error - LangGraph type definitions are overly strict
    graph.addEdge('normalizeTurns', 'chunkConversation');
    // @ts-expect-error - LangGraph type definitions are overly strict
    graph.addEdge('chunkConversation', 'retrieveContext');
    // @ts-expect-error - LangGraph type definitions are overly strict
    graph.addEdge('retrieveContext', 'judgeChunks');
    // @ts-expect-error - LangGraph type definitions are overly strict
    graph.addEdge('judgeChunks', 'reduceMerge');
    // @ts-expect-error - LangGraph type definitions are overly strict
    graph.addEdge('reduceMerge', 'finalizeScores');
    // @ts-expect-error - LangGraph type definitions are overly strict
    graph.addEdge('finalizeScores', 'persistResults');
    // @ts-expect-error - LangGraph type definitions are overly strict
    graph.addEdge('persistResults', END);

    return graph.compile();
  }

  private wrapTiming(
    node: string,
    handler: (
      state: AssessmentStateType,
    ) => Promise<Partial<AssessmentStateType>>,
  ) {
    return async (state: AssessmentStateType) => {
      const started = Date.now();
      const result = await handler(state);
      const ms = Date.now() - started;
      const timings = [...(state.nodeTimings ?? []), { node, ms }];
      return { ...result, nodeTimings: timings };
    };
  }

  private loadSessionData = async (state: AssessmentStateType) => {
    const turns = await this.prisma.client.turn.findMany({
      where: {
        iteration: {
          sessionId: state.sessionId,
          sessionMemberId: state.sessionMemberId,
        },
      },
      orderBy: [{ iteration: { iterationNumber: 'asc' } }, { order: 'asc' }],
      include: {
        messages: true,
        iteration: { select: { iterationNumber: true } },
      },
    });

    if (state.mode === 'live' && state.config.live.maxTurns > 0) {
      return { turnsRaw: turns.slice(-state.config.live.maxTurns) };
    }

    return { turnsRaw: turns };
  };

  private normalizeTurns = (
    state: AssessmentStateType,
  ): Promise<Partial<AssessmentStateType>> => {
    const normalized: NormalizedTurn[] = (state.turnsRaw ?? []).map((turn) => {
      const text =
        turn.text ??
        (turn.messages ?? [])
          .map((message) => message.content)
          .filter((content): content is string => typeof content === 'string')
          .join('\n');

      const role = turn.role ?? 'user';
      const isEvaluated =
        state.config.judgeScope === 'user-only' ? role === 'user' : true;

      return {
        turnId: turn.id,
        role,
        text: text ?? '',
        createdAt: turn.createdAt?.toISOString?.() ?? undefined,
        iterationId: turn.iterationId ?? undefined,
        iterationNumber: turn.iteration?.iterationNumber ?? undefined,
        isEvaluated,
      };
    });

    return Promise.resolve({ turns: normalized });
  };

  private chunkConversation = (
    state: AssessmentStateType,
  ): Promise<Partial<AssessmentStateType>> => {
    const chunkSize = state.config.chunk.size;
    const chunks: AssessmentChunk[] = [];
    const turns = state.turns ?? [];

    for (let i = 0; i < turns.length; i += chunkSize) {
      const slice = turns.slice(i, i + chunkSize);
      chunks.push({
        chunkIndex: chunks.length,
        turns: slice,
        turnIds: slice.map((turn) => turn.turnId),
      });
    }

    return Promise.resolve({ chunks });
  };

  private retrieveContext = async (
    state: AssessmentStateType,
  ): Promise<Partial<AssessmentStateType>> => {
    const chunks = state.chunks ?? [];
    if (!state.config.rag.enabled) {
      return Promise.resolve({
        retrievalByChunk: [],
        warnings: state.warnings ?? [],
      });
    }

    const warnings = [...(state.warnings ?? [])];
    const retrievalResults: Array<{
      chunkIndex: number;
      items: RetrievalItem[];
    }> = [];

    await Promise.all(
      chunks.map(async (chunk) => {
        try {
          const queryText = chunk.turns
            .map((t) => t.text)
            .join(' ')
            .slice(0, 1000);

          const items = await this.ragService.retrieve({
            query: queryText,
            namespaces: [state.config.rag.namespace ?? 'kb', 'history'],
            topK: 5,
            minScore: 0.72,
          });

          retrievalResults.push({
            chunkIndex: chunk.chunkIndex,
            items: items.map((r) => ({
              id: r.id,
              source: r.source ?? r.refType,
              content: r.text,
            })),
          });
        } catch (err) {
          warnings.push(
            `RAG retrieval failed for chunk ${chunk.chunkIndex}: ${(err as Error)?.message ?? err}`,
          );
          retrievalResults.push({ chunkIndex: chunk.chunkIndex, items: [] });
        }
      }),
    );

    // Sort by chunkIndex to maintain stable ordering
    retrievalResults.sort((a, b) => a.chunkIndex - b.chunkIndex);

    if (retrievalResults.every((r) => r.items.length === 0)) {
      warnings.push('RAG enabled but no retrieval results produced.');
    }

    return {
      retrievalByChunk: retrievalResults,
      warnings,
    } as Partial<AssessmentStateType>;
  };

  private judgeChunks = async (state: AssessmentStateType) => {
    const chunks = state.chunks ?? [];
    const config = state.config;
    const judgments: ChunkJudgment[] = [];
    const warnings = [...(state.warnings ?? [])];
    let partial = state.partial ?? false;
    const limit = Math.max(1, config.limits.maxParallelChunks);

    await this.runWithConcurrency(chunks, limit, async (chunk) => {
      const retrievalContext = this.getRetrievalForChunk(
        state,
        chunk.chunkIndex,
      );
      const judgeOutput = await this.runJudge(
        chunk,
        retrievalContext,
        config,
        state,
      );
      if (!judgeOutput.labels || judgeOutput.labels.length === 0) {
        warnings.push(`chunk_${chunk.chunkIndex}_judge_empty`);
        partial = true;
      }
      judgments.push({
        chunkIndex: chunk.chunkIndex,
        summary: judgeOutput.summary,
        labels: judgeOutput.labels,
        retrievalContext,
      });
    });

    return { judgments, warnings, partial };
  };

  private reduceMerge = (
    state: AssessmentStateType,
  ): Promise<Partial<AssessmentStateType>> => {
    const config = state.config;
    const grouped = new Map<string, ChunkJudgment['labels']>();

    for (const judgment of state.judgments ?? []) {
      for (const label of judgment.labels ?? []) {
        const existing = grouped.get(label.turnId) ?? [];
        grouped.set(label.turnId, [...existing, label]);
      }
    }

    const merged: ChunkJudgment['labels'] = [];
    for (const [turnId, labels] of grouped) {
      const sorted = [...labels].sort(
        (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0),
      );
      const top = sorted[0];
      if (!top) {
        continue;
      }

      const applied = this.applyConfidenceAndConflicts(sorted, config);
      merged.push(...applied.map((label) => ({ ...label, turnId })));
    }

    return Promise.resolve({ labels: merged });
  };

  private finalizeScores = (
    state: AssessmentStateType,
  ): Promise<Partial<AssessmentStateType>> => {
    const config = state.config;
    const turnById = new Map(
      (state.turns ?? []).map((turn) => [turn.turnId, turn]),
    );
    const finalLabels = (state.labels ?? []).map((label) => {
      const scoreDelta =
        label.scoreDelta ?? config.labelScoreDelta[label.label] ?? 0;
      return {
        ...label,
        scoreDelta,
      };
    });

    const scoreResult = computeScore(
      finalLabels.map((label) => ({
        label: label.label,
        scoreDelta: label.scoreDelta ?? undefined,
      })),
      config,
    );

    const narrativeSummary = (state.judgments ?? [])
      .map((judgment) => judgment.summary)
      .filter(Boolean)
      .join('\n');
    const coachTips = this.buildCoachTips(finalLabels);

    const summary: AssessmentSummaryResult = {
      totalScore: scoreResult.totalScore,
      scoreBreakdown: scoreResult.scoreBreakdown,
      narrativeSummary: narrativeSummary || undefined,
      coachTips: coachTips.length ? coachTips : undefined,
    };

    const objectiveMetCount = scoreResult.scoreBreakdown?.ObjectiveMet ?? 0;
    const objectiveNotMetCount =
      scoreResult.scoreBreakdown?.ObjectiveNotMet ?? 0;
    const objectiveMet =
      objectiveMetCount + objectiveNotMetCount > 0
        ? objectiveMetCount >= objectiveNotMetCount
        : undefined;

    const report: AssessmentReportPayload = {
      totalScore: scoreResult.totalScore,
      scoreBreakdown: scoreResult.scoreBreakdown,
      summary: {
        narrativeSummary: narrativeSummary || undefined,
        coachTips: coachTips.length ? coachTips : undefined,
        objectiveMet,
      },
      turnAnnotations: finalLabels.map((label) => ({
        turnId: label.turnId,
        role: turnById.get(label.turnId)?.role,
        text: turnById.get(label.turnId)?.text,
        label: label.label,
        confidence: label.confidence,
        evidence: label.evidence ?? undefined,
        scoreDelta: label.scoreDelta,
        citations: label.citations,
        reasonSummary: label.reasonSummary,
        isFinal: label.isFinal,
      })),
      conversationHistory: (state.turns ?? []).map((turn) => ({
        turnId: turn.turnId,
        role: turn.role,
        text: turn.text,
        createdAt: turn.createdAt,
        iterationId: turn.iterationId,
        iterationNumber: turn.iterationNumber,
        isEvaluated: turn.isEvaluated,
      })),
      chunks: (state.judgments ?? []).map((judgment) => ({
        chunkIndex: judgment.chunkIndex,
        turnIds:
          (state.chunks ?? []).find(
            (chunk) => chunk.chunkIndex === judgment.chunkIndex,
          )?.turnIds ?? [],
        summary: judgment.summary,
        retrievalContext: judgment.retrievalContext,
      })),
      rag: state.config.rag.enabled
        ? {
            namespace: state.config.rag.namespace,
            snapshotId: state.config.rag.snapshotId,
          }
        : undefined,
    };

    return Promise.resolve({ summary, report, labels: finalLabels });
  };

  private buildCoachTips(
    labels: ChunkJudgment['labels'],
  ): Array<{ text: string; link?: string }> {
    if (!labels || labels.length === 0) {
      return [];
    }

    const counts = labels.reduce(
      (acc, label) => {
        acc[label.label] = (acc[label.label] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const tips: Array<{ text: string; link?: string }> = [];

    if ((counts.ObjectiveNotMet ?? 0) > 0) {
      tips.push({
        text: 'Open with direct objective fit, then support it with one concrete proof point and one explicit next step.',
      });
    }

    if ((counts.NegativeExample ?? 0) + (counts.MissedOpportunity ?? 0) > 0) {
      tips.push({
        text: 'When the other party raises a concern, answer that concern first before introducing additional benefits.',
      });
    }

    if ((counts.InsightfulQuestion ?? 0) === 0) {
      tips.push({
        text: 'Add one focused follow-up question each turn to uncover constraints, timeline, or decision criteria.',
      });
    }

    if (
      (counts.Neutral ?? 0) >=
      Math.max(2, Math.ceil((labels.length || 1) * 0.6))
    ) {
      tips.push({
        text: 'Replace vague language with specifics: include a number, timeline, or concrete implementation detail.',
      });
    }

    if ((counts.PositiveExample ?? 0) > 0) {
      tips.push({
        text: 'Keep your strongest behavior: concise, relevant responses that directly map to stakeholder concerns.',
      });
    }

    if (tips.length === 0) {
      tips.push({
        text: 'Stay structured: answer directly, add evidence, and close with a clear next action.',
      });
    }

    return tips.slice(0, 4);
  }

  private persistResults = async (state: AssessmentStateType) => {
    if (!state.summary || !state.report) {
      return {};
    }

    await this.assessmentRepository.createLabels(
      (state.labels ?? []).map((label) => ({
        assessmentRunId: state.runId,
        turnId: label.turnId,
        label: label.label,
        confidence: label.confidence ?? undefined,
        scoreDelta: label.scoreDelta ?? undefined,
        evidence: label.evidence ?? undefined,
        isFinal: label.isFinal ?? true,
      })),
    );

    await this.assessmentRepository.upsertSummary({
      assessmentRunId: state.runId,
      totalScore: state.summary.totalScore,
      scoreBreakdown: state.summary.scoreBreakdown,
      narrativeSummary: state.summary.narrativeSummary,
      coachTips: state.summary.coachTips,
    });

    try {
      await this.assessmentReportRepository.upsert({
        runId: state.runId,
        iterationId: state.iterationId,
        sessionMemberId: state.sessionMemberId,
        sessionId: state.sessionId ?? undefined,
        mode: state.mode,
        configVersion: state.configVersion,
        engineVersion: state.engineVersion,
        reportVersion: state.configVersion,
        report: state.report,
        trace: {
          nodeTimings: state.nodeTimings,
          warnings: state.warnings,
          partial: state.partial,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to persist assessment report for run ${state.runId}: ${String(
          (error as Error)?.message || error,
        )}`,
      );
    }

    return {};
  };

  private getRetrievalForChunk(
    state: AssessmentStateType,
    chunkIndex: number,
  ): RetrievalItem[] {
    const anyState = state as AssessmentStateType & {
      retrievalByChunk?: Array<{ chunkIndex: number; items: RetrievalItem[] }>;
    };
    const match = anyState.retrievalByChunk?.find(
      (item) => item.chunkIndex === chunkIndex,
    );
    return match?.items ?? [];
  }

  private applyConfidenceAndConflicts(
    labels: ChunkJudgment['labels'],
    config: AssessmentConfig,
  ): ChunkJudgment['labels'] {
    const finalLabels: ChunkJudgment['labels'] = [];

    for (const label of labels) {
      if ((label.confidence ?? 0) < config.thresholds.confidenceCutoff) {
        finalLabels.push({
          ...label,
          label: AssessmentLabelValue.Neutral,
          scoreDelta: 0,
          isFinal: true,
        });
        continue;
      }

      if (
        label.label === AssessmentLabelValue.NegativeExample &&
        !label.evidence
      ) {
        finalLabels.push({
          ...label,
          label: AssessmentLabelValue.Neutral,
          scoreDelta: 0,
          isFinal: true,
        });
        continue;
      }

      finalLabels.push({ ...label, isFinal: label.isFinal ?? true });
    }

    // Resolve mutually exclusive conflicts by selecting the highest confidence
    for (const group of config.conflictRules.mutuallyExclusive) {
      const groupLabels = finalLabels.filter((label) =>
        group.includes(label.label),
      );
      if (groupLabels.length <= 1) {
        continue;
      }

      const winner = groupLabels.sort(
        (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0),
      )[0];
      for (const label of groupLabels) {
        if (label !== winner) {
          label.isFinal = false;
        }
      }
    }

    return finalLabels;
  }

  private async runJudge(
    chunk: AssessmentChunk,
    retrievalContext: RetrievalItem[],
    config: AssessmentConfig,
    state: AssessmentStateType,
  ): Promise<JudgeOutput> {
    const systemPrompt = await buildJudgeSystemPrompt(config);
    const userPrompt = buildJudgeUserPrompt({
      chunkIndex: chunk.chunkIndex,
      turns: chunk.turns.map((turn) => ({
        turnId: turn.turnId,
        role: turn.role,
        text: turn.text,
        createdAt: turn.createdAt,
      })),
      retrievedContext: retrievalContext,
    });

    const executeJudgeRaw = async (): Promise<string> => {
      const response = await this.llmService.complete(
        {
          sessionId: state.sessionId,
          iterationId: state.iterationId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          config: {
            model: config.judge.model,
            provider: config.judge.provider,
            temperature: config.judge.temperature,
            maxTokens: config.judge.maxTokens,
          },
        },
        {
          userId: state.userId ?? undefined,
          requestId: `assessment-${state.runId}-${chunk.chunkIndex}`,
          purpose: 'evaluation',
        },
      );
      return response.content ?? '';
    };

    const primaryAttempt = await this.withTimeout(
      executeJudgeRaw(),
      config.timeBudgetMs.judge,
      { chunkIndex: chunk.chunkIndex },
    );
    if (primaryAttempt.status !== 'ok') {
      return this.buildNeutralJudgeOutput(chunk, config);
    }

    let primary = this.parseJudgeOutput(primaryAttempt.value, chunk.chunkIndex);
    if (!primary) {
      const retryAttempt = await this.withTimeout(
        executeJudgeRaw(),
        config.timeBudgetMs.judge,
        { chunkIndex: chunk.chunkIndex },
      );
      if (retryAttempt.status !== 'ok') {
        return this.buildNeutralJudgeOutput(chunk, config);
      }
      primary = this.parseJudgeOutput(retryAttempt.value, chunk.chunkIndex);
    }
    if (!primary) {
      return this.buildNeutralJudgeOutput(chunk, config);
    }

    primary.labels = this.ensureTurnCoverage(
      primary.labels,
      chunk.turns,
      config,
    );

    if (!primary.labels || primary.labels.length === 0) {
      return {
        ...primary,
        labels: this.ensureTurnCoverage([], chunk.turns, config),
      };
    }

    if (!this.shouldRunSecondJudge(primary, config)) {
      return primary;
    }

    const secondaryAttempt = await this.withTimeout(
      executeJudgeRaw(),
      config.timeBudgetMs.judge,
      { chunkIndex: chunk.chunkIndex },
    );
    if (secondaryAttempt.status !== 'ok') {
      return primary;
    }

    const secondary = this.parseJudgeOutput(
      secondaryAttempt.value,
      chunk.chunkIndex,
    );
    if (!secondary) {
      return primary;
    }

    secondary.labels = this.ensureTurnCoverage(
      secondary.labels,
      chunk.turns,
      config,
    );

    return this.mergeJudgeOutputs(primary, secondary, config);
  }

  private ensureTurnCoverage(
    labels: JudgeOutput['labels'],
    turns: NormalizedTurn[],
    config: AssessmentConfig,
  ): JudgeOutput['labels'] {
    const evaluatedTurns = turns.filter((turn) => turn.isEvaluated);
    if (evaluatedTurns.length === 0) {
      return [];
    }

    const evaluatedIds = new Set(evaluatedTurns.map((turn) => turn.turnId));
    const bestByTurn = new Map<string, JudgeOutput['labels'][number]>();

    for (const label of labels ?? []) {
      if (!evaluatedIds.has(label.turnId)) {
        continue;
      }
      const existing = bestByTurn.get(label.turnId);
      const existingConfidence = existing?.confidence ?? 0;
      const currentConfidence = label.confidence ?? 0;
      if (!existing || currentConfidence >= existingConfidence) {
        bestByTurn.set(label.turnId, label);
      }
    }

    for (const turn of evaluatedTurns) {
      if (bestByTurn.has(turn.turnId)) {
        continue;
      }
      bestByTurn.set(turn.turnId, {
        turnId: turn.turnId,
        label: AssessmentLabelValue.Neutral,
        confidence: config.thresholds.confidenceCutoff,
        evidence: null,
        scoreDelta: config.labelScoreDelta[AssessmentLabelValue.Neutral] ?? 0,
        citations: [],
        reasonSummary: 'No clear positive or negative signal identified.',
      });
    }

    return evaluatedTurns
      .map((turn) => bestByTurn.get(turn.turnId))
      .filter((label): label is JudgeOutput['labels'][number] =>
        Boolean(label),
      );
  }

  private parseJudgeOutput(
    raw: string,
    chunkIndex: number,
  ): JudgeOutput | null {
    if (!raw || raw.trim().length === 0) {
      this.logger.warn(`Judge returned empty output for chunk ${chunkIndex}`);
      return null;
    }

    try {
      const jsonText = this.extractJson(raw);
      return JudgeOutputSchema.parse(JSON.parse(jsonText));
    } catch (error) {
      this.logger.warn(
        `Failed to parse judge output for chunk ${chunkIndex}: ${String(
          (error as Error)?.message || error,
        )}`,
      );
      return null;
    }
  }

  private extractJson(text: string): string {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      return text;
    }
    return text.slice(start, end + 1);
  }

  private async runWithConcurrency<T>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<void>,
  ): Promise<void> {
    const queue = [...items];
    const workers: Promise<void>[] = [];

    const runWorker = async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) {
          return;
        }
        await worker(item);
      }
    };

    for (let i = 0; i < Math.min(limit, items.length); i += 1) {
      workers.push(runWorker());
    }

    await Promise.all(workers);
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    context: { chunkIndex: number },
  ): Promise<TimedResult<T>> {
    if (!timeoutMs || timeoutMs <= 0) {
      try {
        const value = await promise;
        return { status: 'ok', value };
      } catch (error) {
        this.logger.warn(
          `Judge request failed for chunk ${context.chunkIndex}: ${String((error as Error)?.message || error)}`,
        );
        return { status: 'error' };
      }
    }

    const timeoutSentinel = Symbol('judge-timeout');
    let timeoutHandle: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<typeof timeoutSentinel>((resolve) => {
      timeoutHandle = setTimeout(() => {
        resolve(timeoutSentinel);
      }, timeoutMs);
    });

    try {
      const raced = await Promise.race([promise, timeoutPromise]);
      if (raced === timeoutSentinel) {
        this.logger.warn(
          `Judge timeout for chunk ${context.chunkIndex}: Timeout after ${timeoutMs}ms`,
        );
        return { status: 'timeout' };
      }
      return { status: 'ok', value: raced as T };
    } catch (error) {
      this.logger.warn(
        `Judge request failed for chunk ${context.chunkIndex}: ${String((error as Error)?.message || error)}`,
      );
      return { status: 'error' };
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private buildNeutralJudgeOutput(
    chunk: AssessmentChunk,
    config: AssessmentConfig,
  ): JudgeOutput {
    return {
      chunkIndex: chunk.chunkIndex,
      summary:
        'Judge output could not be parsed. Marked turns as neutral for this chunk.',
      labels: this.ensureTurnCoverage([], chunk.turns, config),
    };
  }

  private shouldRunSecondJudge(
    output: JudgeOutput,
    config: AssessmentConfig,
  ): boolean {
    return output.labels.some((label) => {
      const confidence = label.confidence ?? 0;
      const scoreDelta =
        label.scoreDelta ?? config.labelScoreDelta[label.label] ?? 0;
      return (
        confidence < config.thresholds.confidenceCutoff ||
        scoreDelta <= config.thresholds.negativeDeltaTrigger
      );
    });
  }

  private mergeJudgeOutputs(
    primary: JudgeOutput,
    secondary: JudgeOutput,
    config: AssessmentConfig,
  ): JudgeOutput {
    const byTurn = new Map<
      string,
      {
        a: (typeof primary.labels)[0] | undefined;
        b: (typeof primary.labels)[0] | undefined;
      }
    >();

    for (const label of primary.labels) {
      byTurn.set(label.turnId, { a: label, b: undefined });
    }
    for (const label of secondary.labels) {
      const existing = byTurn.get(label.turnId);
      byTurn.set(label.turnId, { a: existing?.a, b: label });
    }

    const merged = Array.from(byTurn.values()).map((entry) => {
      const a = entry.a;
      const b = entry.b;
      if (!a) return b as (typeof primary.labels)[0];
      if (!b) return a;

      if (a.label === b.label) {
        return {
          ...a,
          confidence: ((a.confidence ?? 0) + (b.confidence ?? 0)) / 2,
          isFinal: true,
        };
      }

      const aPolarity = this.getLabelPolarity(a.label, config);
      const bPolarity = this.getLabelPolarity(b.label, config);
      if (aPolarity === bPolarity && aPolarity !== 'neutral') {
        return (a.confidence ?? 0) >= (b.confidence ?? 0)
          ? { ...a, isFinal: true }
          : { ...b, isFinal: true };
      }

      const diff = Math.abs((a.confidence ?? 0) - (b.confidence ?? 0));
      if (diff < config.thresholds.disagreementCutoff) {
        return {
          ...a,
          label: AssessmentLabelValue.Neutral,
          scoreDelta: 0,
          isFinal: true,
        };
      }

      return (a.confidence ?? 0) >= (b.confidence ?? 0)
        ? { ...a, isFinal: true }
        : { ...b, isFinal: true };
    });

    return {
      chunkIndex: primary.chunkIndex,
      summary: primary.summary || secondary.summary,
      labels: merged,
    };
  }

  private getLabelPolarity(
    label: AssessmentLabelValue,
    config: AssessmentConfig,
  ): 'positive' | 'negative' | 'neutral' {
    const delta = config.labelScoreDelta[label] ?? 0;
    if (delta > 0) {
      return 'positive';
    }
    if (delta < 0) {
      return 'negative';
    }
    return 'neutral';
  }
}
