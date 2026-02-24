import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/simulation-client';
import { ScenarioRepository } from '../repositories/scenario.repository';
import {
  GenerateScenarioRequestDto,
  ScenarioResponseDto,
  ScenarioListResponseDto,
  GenerateScenarioBatchRequestDto,
} from '../dto/scenario.dto';
import { LLMService } from './llm/llm.service';
import { LLMRoutingConfigService } from './llm/llm-routing-config.service';
import { LLMRequestDto } from '../dto/llm.dto';
import { buildScenarioSystemPrompt } from '../prompts/scenario.prompt';

@Injectable()
export class ScenarioService {
  private readonly logger = new Logger(ScenarioService.name);

  constructor(
    private readonly scenarioRepository: ScenarioRepository,
    private readonly llmService: LLMService,
    private readonly routingConfigService: LLMRoutingConfigService,
  ) {}

  async generate(
    request: GenerateScenarioRequestDto,
  ): Promise<ScenarioResponseDto> {
    return this.generateOne(request);
  }

  async generateBatch(
    request: GenerateScenarioBatchRequestDto,
  ): Promise<ScenarioListResponseDto> {
    const count = Math.max(1, Math.min(5, request.count ?? 3));
    const scenarios: ScenarioResponseDto[] = [];

    for (let i = 0; i < count; i += 1) {
      const scenario = await this.generateOne({
        ...request,
      });
      scenarios.push(scenario);
    }

    return {
      scenarios,
      total: scenarios.length,
    };
  }

  private async generateOne(
    request: GenerateScenarioRequestDto,
  ): Promise<ScenarioResponseDto> {
    this.logger.log(`Generating scenario for org ${request.orgId}`);

    const routingConfig = await this.routingConfigService.getActiveConfig({
      orgId: request.orgId,
      userId: request.requestedBy,
    });

    const defaultRoute = routingConfig.defaultRoute ?? {
      provider: 'openai',
      model: 'gpt-4o',
    };

    const systemPrompt = await buildScenarioSystemPrompt();

    const userPrompt = JSON.stringify(
      {
        name: request.name,
        type: request.type,
        tags: request.tags,
        language: request.language,
        sessionConfig: request.sessionConfig,
        personaId: request.personaId,
        crmContextId: request.crmContextId,
        userSnapshot: request.userSnapshot,
        orgSnapshot: request.orgSnapshot,
        objective: request.objective,
        context: request.context,
      },
      null,
      2,
    );

    const llmRequest: LLMRequestDto = {
      sessionId: `scenario-gen:${request.orgId}`,
      userId: request.requestedBy,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Generate a scenario from this input:\n${userPrompt}`,
        },
      ],
      config: {
        provider: defaultRoute.provider,
        model: defaultRoute.model,
        temperature: 0.7,
        maxTokens: 900,
      },
    };

    const response = await this.llmService.complete(llmRequest, {
      orgId: request.orgId,
      userId: request.requestedBy,
      purpose: 'scenario_generation',
    });

    const parsed = this.extractScenario(response.content ?? '');
    const fallbackName = request.name ?? 'Generated Scenario';

    const config = {
      ...this.buildBaseConfig(request),
      ...(parsed?.config ?? {}),
    };

    const scenario = await this.scenarioRepository.create({
      orgId: request.orgId,
      name: parsed?.name?.trim() || fallbackName,
      description:
        parsed?.description?.trim() || response.content?.trim() || undefined,
      config: config as Prisma.InputJsonValue,
    });

    return this.mapToResponseDto(scenario);
  }

  async findAll(orgId?: string): Promise<ScenarioListResponseDto> {
    const scenarios = await this.scenarioRepository.findMany(
      orgId ? { orgId } : undefined,
    );
    return {
      scenarios: scenarios.map(this.mapToResponseDto),
      total: scenarios.length,
    };
  }

  async findById(id: string): Promise<ScenarioResponseDto> {
    const scenario = await this.scenarioRepository.findById(id);
    if (!scenario) {
      throw new NotFoundException(`Scenario with ID ${id} not found`);
    }
    return this.mapToResponseDto(scenario);
  }

  private buildBaseConfig(request: GenerateScenarioRequestDto) {
    return {
      objective: request.objective,
      context: request.context,
      tags: request.tags,
      language: request.language,
      type: request.type,
      personaId: request.personaId,
      crmContextId: request.crmContextId,
      sessionConfig: request.sessionConfig,
      userSnapshot: request.userSnapshot,
      orgSnapshot: request.orgSnapshot,
    };
  }

  private extractScenario(content: string): {
    name?: string;
    description?: string;
    config?: Record<string, any>;
  } | null {
    if (!content) return null;

    const fenced = content.match(/```json\s*([\s\S]*?)\s*```/i);
    const raw = fenced ? fenced[1] : content;
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<
        string,
        any
      >;
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        name: typeof parsed.name === 'string' ? parsed.name : undefined,
        description:
          typeof parsed.description === 'string'
            ? parsed.description
            : undefined,
        config:
          parsed.config && typeof parsed.config === 'object'
            ? (parsed.config as Record<string, any>)
            : undefined,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to parse scenario JSON from LLM output: ${(error as Error)?.message}`,
      );
      return null;
    }
  }

  private readonly mapToResponseDto = (scenario: {
    id: string;
    orgId: string;
    name: string;
    description: string | null;
    config: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
  }): ScenarioResponseDto => {
    return {
      id: scenario.id,
      orgId: scenario.orgId,
      name: scenario.name,
      description: scenario.description ?? undefined,
      config: (scenario.config as Record<string, any>) ?? undefined,
      createdAt: scenario.createdAt.toISOString(),
      updatedAt: scenario.updatedAt.toISOString(),
    };
  };
}
