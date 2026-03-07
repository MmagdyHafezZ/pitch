import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Persona, Prisma } from '@prisma/simulation-client';
import { PersonaRepository } from '../repositories/persona.repository';
import { CreatePersonaDto } from '../dto/persona.dto';
import { TtsService } from '../tts/tts.service';
import { PersonaMediaService } from './persona-media.service';

export interface PersonaResponseDto {
  id: string;
  orgId: string;
  name: string;
  traits?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PersonaListResponseDto {
  personas: PersonaResponseDto[];
  total: number;
}

export interface PersonaPreviewAudioDto {
  audioBuffer: Buffer;
  contentType: string;
}

@Injectable()
export class PersonaService {
  private readonly logger = new Logger(PersonaService.name);

  constructor(
    private readonly personaRepository: PersonaRepository,
    private readonly ttsService: TtsService,
    private readonly personaMediaService: PersonaMediaService,
  ) {}

  async create(
    createPersonaDto: CreatePersonaDto,
  ): Promise<PersonaResponseDto> {
    const payload = this.validateAndNormalizeCreateDto(createPersonaDto);
    this.logger.log(`Creating persona: ${payload.name}`);

    const persona = await this.personaRepository.create(payload);
    void this.personaMediaService.warmPreviewAudio({
      personaId: persona.id,
      name: persona.name,
      traits: persona.traits,
    });
    return this.mapToResponseDto(persona);
  }

  async findAll(orgId?: string): Promise<PersonaListResponseDto> {
    const personas = await this.personaRepository.findMany(
      orgId ? { orgId } : undefined,
    );
    this.logger.log(`Found ${personas.length} personas`);

    return {
      personas: personas.map(this.mapToResponseDto),
      total: personas.length,
    };
  }

  async findById(id: string): Promise<PersonaResponseDto> {
    this.logger.log(`Finding persona with ID: ${id}`);

    const persona = await this.personaRepository.findById(id);
    if (!persona) {
      throw new NotFoundException(`Persona with ID ${id} not found`);
    }

    return this.mapToResponseDto(persona);
  }

  async findByOrgId(orgId: string): Promise<PersonaListResponseDto> {
    this.logger.log(`Finding personas for org: ${orgId}`);

    const personas = await this.personaRepository.findByOrgId(orgId);

    return {
      personas: personas.map(this.mapToResponseDto),
      total: personas.length,
    };
  }

  async getPreviewAudio(id: string): Promise<PersonaPreviewAudioDto | null> {
    const persona = await this.personaRepository.findById(id);
    if (!persona) {
      throw new NotFoundException(`Persona with ID ${id} not found`);
    }

    const audio = await this.personaMediaService.getOrCreatePreviewAudio({
      personaId: persona.id,
      name: persona.name,
      traits: persona.traits,
    });

    if (!audio) {
      return null;
    }

    return {
      audioBuffer: audio.audioBuffer,
      contentType: audio.contentType,
    };
  }

  private readonly mapToResponseDto = (
    persona: Persona,
  ): PersonaResponseDto => {
    return {
      id: persona.id,
      orgId: persona.orgId,
      name: persona.name,
      traits: this.personaMediaService.enrichTraits({
        personaId: persona.id,
        name: persona.name,
        traits: persona.traits,
      }),
      createdAt: persona.createdAt,
      updatedAt: persona.updatedAt,
    };
  };

  private validateAndNormalizeCreateDto(
    createPersonaDto: CreatePersonaDto,
  ): CreatePersonaDto {
    const name = this.normalizeText(
      createPersonaDto.name,
      'Persona name',
      2,
      80,
    );
    const orgId = this.normalizeText(
      createPersonaDto.orgId,
      'Organization ID',
      2,
      120,
    );

    let traits: Prisma.InputJsonValue | undefined;
    if (createPersonaDto.traits !== undefined) {
      if (!this.isRecord(createPersonaDto.traits)) {
        throw new BadRequestException('Persona traits must be an object');
      }

      traits = this.validateTraits(
        createPersonaDto.traits as Record<string, unknown>,
      ) as Prisma.InputJsonValue;

      traits = this.personaMediaService.enrichTraits({
        name,
        traits,
      }) as Prisma.InputJsonValue;
    }

    return {
      ...createPersonaDto,
      orgId,
      name,
      traits,
    };
  }

  private validateTraits(
    traits: Record<string, unknown>,
  ): Record<string, unknown> {
    const nextTraits: Record<string, unknown> = { ...traits };

    const boundedTextFields = [
      ['role', 2, 80],
      ['level', 2, 40],
      ['personality', 6, 240],
      ['background', 6, 320],
      ['tone', 2, 40],
      ['archetype', 2, 40],
      ['voiceProfile', 2, 120],
      ['rarity', 2, 24],
      ['patience', 2, 24],
      ['communicationStyle', 2, 80],
      ['mood', 2, 40],
      ['temperament', 2, 40],
    ] as const;

    for (const [field, minLength, maxLength] of boundedTextFields) {
      const value = traits[field];
      if (value === undefined || value === null || value === '') {
        delete nextTraits[field];
        continue;
      }

      nextTraits[field] = this.normalizeText(
        value,
        `traits.${field}`,
        minLength,
        maxLength,
      );
    }

    if (traits.signatureTraits !== undefined) {
      nextTraits.signatureTraits = this.normalizeStringArray(
        traits.signatureTraits,
        'traits.signatureTraits',
        1,
        6,
        48,
      );
    }

    if (traits.highlights !== undefined) {
      nextTraits.highlights = this.normalizeStringArray(
        traits.highlights,
        'traits.highlights',
        1,
        6,
        48,
      );
    }

    if (traits.metrics !== undefined) {
      nextTraits.metrics = this.normalizeMetrics(traits.metrics);
    }

    if (traits.voice !== undefined) {
      nextTraits.voice = this.validateVoiceConfig(traits.voice);
      const voice = nextTraits.voice as Record<string, unknown>;
      const providerName =
        typeof voice.provider === 'string' ? voice.provider : undefined;
      const voiceName =
        typeof voice.voiceName === 'string' ? voice.voiceName : undefined;
      if (!nextTraits.voiceProfile && providerName && voiceName) {
        nextTraits.voiceProfile = `${providerName} / ${voiceName}`;
      }
    }

    return nextTraits;
  }

  private validateVoiceConfig(value: unknown): Record<string, unknown> {
    if (!this.isRecord(value)) {
      throw new BadRequestException('traits.voice must be an object');
    }

    const providerName = this.normalizeText(
      value.provider,
      'traits.voice.provider',
      2,
      40,
    ).toLowerCase();
    const voiceName = this.normalizeText(
      value.voiceName,
      'traits.voice.voiceName',
      1,
      120,
    );
    const providers = this.ttsService.listProviders();
    const provider = providers.find((entry) => entry.name === providerName);

    if (!provider) {
      throw new BadRequestException(
        `Unsupported TTS provider "${providerName}"`,
      );
    }

    if (!provider.voices.includes(voiceName)) {
      throw new BadRequestException(
        `Invalid voice "${voiceName}" for provider "${providerName}"`,
      );
    }

    const nextVoice: Record<string, unknown> = {
      provider: providerName,
      voiceName,
    };

    if (
      value.language !== undefined &&
      value.language !== null &&
      value.language !== ''
    ) {
      const language = this.normalizeText(
        value.language,
        'traits.voice.language',
        2,
        16,
      );
      if (!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(language)) {
        throw new BadRequestException(
          'traits.voice.language must use codes like en or en-US',
        );
      }
      nextVoice.language = language;
    }

    if (
      value.model !== undefined &&
      value.model !== null &&
      value.model !== ''
    ) {
      const model = this.normalizeText(
        value.model,
        'traits.voice.model',
        2,
        80,
      );
      const supportedModels = provider.models ?? [];
      if (supportedModels.length > 0 && !supportedModels.includes(model)) {
        throw new BadRequestException(
          `Invalid model "${model}" for provider "${providerName}"`,
        );
      }
      nextVoice.model = model;
    }

    return nextVoice;
  }

  private normalizeMetrics(
    value: unknown,
  ): Record<string, number> | Array<{ label: string; value: number }> {
    if (Array.isArray(value)) {
      return value.map((entry, index) => {
        if (!this.isRecord(entry)) {
          throw new BadRequestException(
            `traits.metrics[${index}] must be an object`,
          );
        }

        const label = this.normalizeText(
          entry.label,
          `traits.metrics[${index}].label`,
          1,
          32,
        );
        const numericValue = this.normalizePercent(
          entry.value,
          `traits.metrics[${index}].value`,
        );

        return { label, value: numericValue };
      });
    }

    if (!this.isRecord(value)) {
      throw new BadRequestException(
        'traits.metrics must be an object or array of metric objects',
      );
    }

    const metrics: Record<string, number> = {};
    for (const [metricName, metricValue] of Object.entries(value)) {
      const normalizedKey = this.normalizeMetricKey(metricName);
      metrics[normalizedKey] = this.normalizePercent(
        metricValue,
        `traits.metrics.${metricName}`,
      );
    }

    return metrics;
  }

  private normalizeMetricKey(value: string): string {
    const normalized = value.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (!normalized) {
      throw new BadRequestException(
        'Metric names must contain letters or numbers',
      );
    }
    return normalized;
  }

  private normalizeStringArray(
    value: unknown,
    field: string,
    minItems: number,
    maxItems: number,
    maxLength: number,
  ): string[] {
    if (!Array.isArray(value)) {
      throw new BadRequestException(`${field} must be an array of strings`);
    }

    const next = Array.from(
      new Set(
        value.map((entry, index) =>
          this.normalizeText(entry, `${field}[${index}]`, 1, maxLength),
        ),
      ),
    );

    if (next.length < minItems || next.length > maxItems) {
      throw new BadRequestException(
        `${field} must contain between ${minItems} and ${maxItems} items`,
      );
    }

    return next;
  }

  private normalizePercent(value: unknown, field: string): number {
    const numericValue =
      typeof value === 'number'
        ? value
        : typeof value === 'string' && value.trim() !== ''
          ? Number(value)
          : Number.NaN;

    if (
      !Number.isFinite(numericValue) ||
      numericValue < 0 ||
      numericValue > 100
    ) {
      throw new BadRequestException(
        `${field} must be a number between 0 and 100`,
      );
    }

    return Math.round(numericValue);
  }

  private normalizeText(
    value: unknown,
    field: string,
    minLength: number,
    maxLength: number,
  ): string {
    if (typeof value !== 'string') {
      throw new BadRequestException(`${field} must be a string`);
    }

    const normalized = value.trim();
    if (normalized.length < minLength || normalized.length > maxLength) {
      throw new BadRequestException(
        `${field} must be between ${minLength} and ${maxLength} characters`,
      );
    }

    return normalized;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
