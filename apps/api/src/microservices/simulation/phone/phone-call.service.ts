import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';
import { PhoneProviderFactory } from './providers/phone.factory';
import { PhoneCallResult, PhoneCallRequest } from './providers/phone.provider';
import { VapiContextService } from './vapi-context.service';
import { TtsService } from '../tts/tts.service';
import { TtsOptions, TtsResult } from '../tts/providers/tts.provider';
import { resolveTtsConfig, type ResolvedTtsConfig } from '../utils/tts-config';

interface StartPhoneCallInput {
  sessionId: string;
  phoneNumber?: string;
  provider?: string;
  userId: string;
  firstMessage?: string;
}

interface SynthesizePhoneCallAudioInput {
  sessionId: string;
  userId: string;
  text: string;
  sampleRate?: number;
}

@Injectable()
export class PhoneCallService {
  private readonly logger = new Logger(PhoneCallService.name);

  constructor(
    private readonly providerFactory: PhoneProviderFactory,
    private readonly prisma: SimulationPrismaService,
    private readonly vapiContext: VapiContextService,
    private readonly ttsService: TtsService,
  ) {}

  async startCall(input: StartPhoneCallInput): Promise<PhoneCallResult> {
    const { sessionId, provider, phoneNumber, userId, firstMessage } = input;

    const session = await this.prisma.client.session.findUnique({
      where: { id: sessionId },
      include: {
        scenario: true,
        persona: true,
      },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    if (session.type !== 'phone') {
      throw new BadRequestException(
        `Session ${sessionId} is not a phone call session`,
      );
    }

    const resolvedNumber =
      phoneNumber ?? this.resolvePhoneNumber(session.sessionConfig);

    if (!resolvedNumber) {
      throw new BadRequestException('Phone number is required to start a call');
    }

    const resolvedProvider =
      provider ?? this.resolvePhoneProvider(session.sessionConfig) ?? 'vapi';

    if (resolvedProvider !== 'vapi') {
      throw new BadRequestException('Only Vapi is supported for phone calls.');
    }

    const providerInstance = this.providerFactory.getProvider(resolvedProvider);

    if (!this.isStrictE164(resolvedNumber)) {
      throw new BadRequestException(
        'Phone number must be in E.164 format (for example +15551234567).',
      );
    }

    const request: PhoneCallRequest = {
      to: resolvedNumber,
      metadata: {
        sessionId,
        userId,
        transport: 'vapi',
      },
    };

    request.providerConfig = this.buildVapiProviderConfig(
      session,
      userId,
      firstMessage,
    );
    this.logVapiRouting(sessionId, userId, request.providerConfig);

    this.logger.log(
      `phone_call.start session=${sessionId} user=${userId} provider=${providerInstance.name} to=${this.maskPhone(resolvedNumber)}`,
    );

    const result = await providerInstance.createCall(request);

    this.logger.log(
      `phone_call.started session=${sessionId} user=${userId} provider=${providerInstance.name} call=${result.callId}`,
    );

    return {
      ...result,
      sessionId,
    };
  }

  async synthesizePhoneCallAudio(
    input: SynthesizePhoneCallAudioInput,
  ): Promise<TtsResult> {
    const text = input.text.trim();
    if (!text) {
      throw new BadRequestException(
        'Phone call voice request must include text to synthesize.',
      );
    }

    const session = await this.prisma.client.session.findUnique({
      where: { id: input.sessionId },
      include: {
        persona: true,
      },
    });

    if (!session) {
      throw new NotFoundException(`Session ${input.sessionId} not found`);
    }

    if (session.type !== 'phone') {
      throw new BadRequestException(
        `Session ${input.sessionId} is not a phone call session`,
      );
    }

    const resolvedTts = this.resolvePhoneTtsConfig(session);
    const sampleRate = this.normalizePhoneSampleRate(input.sampleRate);

    this.logger.log(
      `phone_call.voice.synthesize session=${input.sessionId} user=${input.userId} provider=${resolvedTts.provider} voice=${resolvedTts.voice ?? 'default'} sampleRate=${sampleRate} text="${this.previewText(text)}"`,
    );

    return this.synthesizePcmAudio(text, sampleRate, resolvedTts);
  }

  private resolvePhoneNumber(sessionConfig: unknown): string | undefined {
    if (!sessionConfig || typeof sessionConfig !== 'object') {
      return undefined;
    }

    const config = sessionConfig as Record<string, unknown>;
    const directNumber =
      typeof config.phoneNumber === 'string' ? config.phoneNumber : undefined;
    if (directNumber) return directNumber;

    const phone = config.phone;
    if (phone && typeof phone === 'object') {
      const phoneRecord = phone as Record<string, unknown>;
      if (typeof phoneRecord.number === 'string') {
        return phoneRecord.number;
      }
    }

    return undefined;
  }

  private resolvePhoneProvider(sessionConfig: unknown): string | undefined {
    if (!sessionConfig || typeof sessionConfig !== 'object') {
      return undefined;
    }

    const config = sessionConfig as Record<string, unknown>;
    if (typeof config.phoneProvider === 'string') {
      return config.phoneProvider;
    }

    const phone = this.resolvePhoneConfig(sessionConfig);
    if (!phone) return undefined;

    const provider = phone.provider;
    if (typeof provider === 'string' && provider.trim().length > 0) {
      return provider;
    }

    return undefined;
  }

  private resolveProviderConfig(
    sessionConfig: unknown,
  ): Record<string, unknown> | undefined {
    const phone = this.resolvePhoneConfig(sessionConfig);
    if (!phone) return undefined;

    const vapiConfig = phone.vapi;
    if (vapiConfig && typeof vapiConfig === 'object') {
      return vapiConfig as Record<string, unknown>;
    }

    const providerConfig = phone.providerConfig;
    if (providerConfig && typeof providerConfig === 'object') {
      return providerConfig as Record<string, unknown>;
    }

    return undefined;
  }

  private buildVapiProviderConfig(
    session: {
      id: string;
      name: string | null;
      sessionConfig: unknown;
      scenario?: { description?: string | null } | null;
      persona?: { name: string; traits?: unknown } | null;
    },
    userId: string,
    firstMessageOverride?: string,
  ): Record<string, unknown> {
    const sessionConfigRecord = this.resolveRecord(session.sessionConfig) ?? {};
    const phoneConfig = this.resolvePhoneConfig(session.sessionConfig);
    const existingProviderConfig =
      this.resolveProviderConfig(session.sessionConfig) ?? {};
    const vapiConfig = this.resolveNestedObject(phoneConfig, 'vapi') ?? {};

    const token = this.vapiContext.createToken({
      sessionId: session.id,
      userId,
      purpose: 'phone-call',
    });

    const serverUrl = this.vapiContext.buildGatewayUrl(
      'simulation/phone-calls/vapi/server',
      token,
    );
    const voiceUrl = this.vapiContext.buildGatewayUrl(
      'simulation/phone-calls/vapi/voice',
      token,
    );
    const transcriberConfig =
      this.resolveNestedObject(vapiConfig, 'transcriber') ?? {};
    const voiceConfig = this.resolveNestedObject(vapiConfig, 'voice') ?? {};
    const firstMessage = this.resolvePlaybackText(
      firstMessageOverride ??
        this.resolveString(vapiConfig, 'firstMessage') ??
        this.resolveString(vapiConfig, 'first_message') ??
        this.resolveString(phoneConfig, 'firstMessage') ??
        this.resolveString(sessionConfigRecord, 'firstMessage') ??
        session.scenario?.description ??
        session.name,
    );
    const playbackAudioUrl = this.resolvePlaybackAudioUrl(
      this.resolveString(vapiConfig, 'audioUrl') ??
        this.resolveString(vapiConfig, 'audio_url'),
    );

    if (!firstMessage && !playbackAudioUrl) {
      throw new BadRequestException(
        'Phone call firstMessage text must be configured on the request or session.',
      );
    }

    const assistantBase = {
      name:
        this.resolveString(vapiConfig, 'name') ??
        session.name ??
        (session.persona?.name
          ? `PITCH ${session.persona.name}`
          : 'PITCH Phone Session'),
      maxDurationSeconds:
        this.resolveNumber(vapiConfig, 'maxDurationSeconds') ?? 900,
      server: {
        url: serverUrl,
      },
      transcriber: {
        provider:
          this.resolveString(transcriberConfig, 'provider') ?? 'deepgram',
        model: this.resolveString(transcriberConfig, 'model') ?? 'nova-2',
      },
    };

    const assistant =
      firstMessage != null
        ? {
            ...assistantBase,
            firstMessage,
            firstMessageMode:
              this.resolveString(vapiConfig, 'firstMessageMode') ??
              'assistant-speaks-first',
            modelOutputInMessagesEnabled: false,
            serverMessages: this.resolveStringArray(
              vapiConfig,
              'serverMessages',
            ) ?? [
              'status-update',
              'speech-update',
              'transcript',
              'end-of-call-report',
              'hang',
            ],
            voice: {
              provider: 'custom-voice',
              server: {
                url: voiceUrl,
                ...(this.resolveNumber(voiceConfig, 'timeoutSeconds')
                  ? {
                      timeoutSeconds: this.resolveNumber(
                        voiceConfig,
                        'timeoutSeconds',
                      ),
                    }
                  : {}),
              },
            },
          }
        : {
            ...assistantBase,
            firstMessage: playbackAudioUrl,
            firstMessageMode:
              this.resolveString(vapiConfig, 'firstMessageMode') ??
              'assistant-speaks-first',
            modelOutputInMessagesEnabled: false,
            serverMessages: this.resolveStringArray(
              vapiConfig,
              'serverMessages',
            ) ?? [
              'status-update',
              'speech-update',
              'transcript',
              'end-of-call-report',
              'hang',
            ],
          };

    return {
      ...existingProviderConfig,
      ...vapiConfig,
      assistant,
    };
  }

  private logVapiRouting(
    sessionId: string,
    userId: string,
    providerConfig: Record<string, unknown>,
  ): void {
    const assistant = this.resolveNestedObject(providerConfig, 'assistant');
    const server = this.resolveNestedObject(assistant, 'server');
    const firstMessage = this.resolveString(assistant, 'firstMessage');
    const transcriber = this.resolveNestedObject(assistant, 'transcriber');
    const voice = this.resolveNestedObject(assistant, 'voice');
    const voiceServer = this.resolveNestedObject(voice, 'server');
    const phoneNumberId =
      this.resolveString(providerConfig, 'phoneNumberId') ??
      this.resolveString(providerConfig, 'phone_number_id') ??
      'env_default';
    const serverUrl =
      this.sanitizeUrlForLog(this.resolveString(server, 'url')) ?? 'unknown';
    const firstMessageSummary =
      this.summarizeAssistantFirstMessage(firstMessage);
    const transcriberSummary = [
      this.resolveString(transcriber, 'provider') ?? 'unknown-provider',
      this.resolveString(transcriber, 'model') ?? 'unknown-model',
    ].join('/');
    const voiceSummary =
      this.sanitizeUrlForLog(this.resolveString(voiceServer, 'url')) ??
      this.resolveString(voice, 'provider') ??
      'none';

    this.logger.log(
      `phone_call.routing session=${sessionId} user=${userId} phoneNumberId=${phoneNumberId} server=${serverUrl} voice=${voiceSummary} transcriber=${transcriberSummary} firstMessage=${firstMessageSummary}`,
    );
  }

  private resolvePhoneTtsConfig(session: {
    sessionConfig: unknown;
    persona?: { traits?: unknown } | null;
  }): ResolvedTtsConfig {
    const sessionConfig = this.resolveRecord(session.sessionConfig) ?? {};
    const phoneConfig = this.resolvePhoneConfig(session.sessionConfig);
    const vapiConfig = this.resolveNestedObject(phoneConfig, 'vapi') ?? {};
    const phoneVoice = this.resolveNestedObject(vapiConfig, 'voice') ?? {};
    const baseConfig = resolveTtsConfig({
      sessionConfig,
      personaTraits: session.persona?.traits
        ? (this.resolveRecord(session.persona.traits) ?? null)
        : null,
    });

    return {
      provider:
        this.resolveString(phoneVoice, 'provider') ??
        this.resolveString(vapiConfig, 'voiceProvider') ??
        baseConfig.provider,
      voice:
        this.resolveString(phoneVoice, 'voiceId') ??
        this.resolveString(phoneVoice, 'voiceName') ??
        this.resolveString(phoneVoice, 'voice') ??
        this.resolveString(vapiConfig, 'voiceId') ??
        baseConfig.voice,
      language:
        this.resolveString(phoneVoice, 'language') ?? baseConfig.language,
      model: this.resolveString(phoneVoice, 'model') ?? baseConfig.model,
    };
  }

  private normalizePhoneSampleRate(value: number | undefined): number {
    if (!value || !Number.isFinite(value) || value <= 0) {
      return 24000;
    }

    return Math.round(value);
  }

  private async synthesizePcmAudio(
    text: string,
    sampleRate: number,
    resolvedTts: ResolvedTtsConfig,
  ): Promise<TtsResult> {
    const attempts = this.buildPhoneTtsAttempts(sampleRate, resolvedTts);
    let lastError: unknown;

    for (const attempt of attempts) {
      try {
        return await this.synthesizePhonePcmWithProvider(
          text,
          attempt.provider,
          attempt.options,
        );
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `phone_call.voice.attempt_failed provider=${attempt.provider} voice=${attempt.options.voice ?? 'default'} error=${(error as Error)?.message ?? error}`,
        );
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new BadRequestException('Unable to synthesize phone call audio.');
  }

  private buildPhoneTtsAttempts(
    sampleRate: number,
    resolvedTts: ResolvedTtsConfig,
  ): Array<{ provider: string; options: TtsOptions }> {
    const primaryOptions: TtsOptions = {
      ...(resolvedTts.voice ? { voice: resolvedTts.voice } : {}),
      ...(resolvedTts.language ? { language: resolvedTts.language } : {}),
      ...(resolvedTts.model ? { model: resolvedTts.model } : {}),
      format: 'pcm',
      sampleRate,
    };

    const attempts: Array<{ provider: string; options: TtsOptions }> = [
      {
        provider: resolvedTts.provider || 'elevenlabs',
        options: primaryOptions,
      },
    ];

    const needsElevenLabsFallback =
      resolvedTts.provider !== 'elevenlabs' ||
      resolvedTts.voice != null ||
      resolvedTts.model != null;

    if (needsElevenLabsFallback) {
      attempts.push({
        provider: 'elevenlabs',
        options: {
          ...(resolvedTts.language ? { language: resolvedTts.language } : {}),
          format: 'pcm',
          sampleRate,
        },
      });
    }

    return attempts;
  }

  private async synthesizePhonePcmWithProvider(
    text: string,
    provider: string,
    options: TtsOptions,
  ): Promise<TtsResult> {
    let audioBuffer: Buffer;
    let contentType: string;

    try {
      const streamResult = await this.ttsService.synthesizeStream(
        text,
        provider,
        options,
      );
      const chunks: Uint8Array[] = [];
      for await (const chunk of streamResult.audioStream) {
        chunks.push(chunk);
      }
      audioBuffer = Buffer.concat(chunks);
      contentType = streamResult.contentType;
    } catch (streamError) {
      const message = (streamError as Error)?.message ?? '';
      if (!message.includes('does not support streaming')) {
        throw streamError;
      }

      const result = await this.ttsService.synthesize(text, provider, options);
      audioBuffer = result.audioBuffer;
      contentType = result.contentType;
    }

    if (!contentType.toLowerCase().startsWith('audio/pcm')) {
      throw new BadRequestException(
        `TTS provider "${provider}" returned unsupported content type "${contentType}" for phone audio.`,
      );
    }

    return { audioBuffer, contentType };
  }

  private resolvePhoneConfig(
    sessionConfig: unknown,
  ): Record<string, unknown> | undefined {
    if (!sessionConfig || typeof sessionConfig !== 'object') {
      return undefined;
    }

    const config = sessionConfig as Record<string, unknown>;
    const phone = config.phone;
    if (phone && typeof phone === 'object') {
      return phone as Record<string, unknown>;
    }

    return undefined;
  }

  private isStrictE164(value: string): boolean {
    return /^\+[1-9]\d{7,14}$/.test(value);
  }

  private resolveString(
    source: Record<string, unknown> | undefined,
    key: string,
  ): string | undefined {
    if (!source) {
      return undefined;
    }

    const value = source[key];
    return typeof value === 'string' && value.trim().length > 0
      ? value
      : undefined;
  }

  private resolveNumber(
    source: Record<string, unknown> | undefined,
    key: string,
  ): number | undefined {
    if (!source) {
      return undefined;
    }

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

  private resolveNestedObject(
    source: Record<string, unknown> | null | undefined,
    key: string,
  ): Record<string, unknown> | undefined {
    if (!source) {
      return undefined;
    }

    const value = source[key];
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : undefined;
  }

  private resolveRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : undefined;
  }

  private resolveStringArray(
    source: Record<string, unknown> | undefined,
    key: string,
  ): string[] | undefined {
    if (!source) {
      return undefined;
    }

    const value = source[key];
    if (!Array.isArray(value)) {
      return undefined;
    }

    const items = value.filter(
      (entry): entry is string =>
        typeof entry === 'string' && entry.trim().length > 0,
    );

    return items.length > 0 ? items : undefined;
  }

  private sanitizeUrlForLog(url: string | undefined): string | undefined {
    if (!url) {
      return undefined;
    }

    try {
      const parsed = new URL(url);
      if (parsed.searchParams.has('token')) {
        parsed.searchParams.set('token', '[redacted]');
      }
      return parsed.toString();
    } catch {
      return url;
    }
  }

  private summarizeAssistantFirstMessage(value: string | undefined): string {
    if (!value) {
      return 'none';
    }

    const sanitizedUrl = this.sanitizeUrlForLog(value);
    if (sanitizedUrl) {
      try {
        const parsed = new URL(value);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          return sanitizedUrl;
        }
      } catch {
        // Fall through to text preview when value is not a URL.
      }
    }

    return this.previewText(value);
  }

  private resolvePlaybackText(
    value: string | undefined | null,
  ): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private resolvePlaybackAudioUrl(
    value: string | undefined,
  ): string | undefined {
    if (!value) {
      return undefined;
    }

    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('unsupported protocol');
      }
      return parsed.toString();
    } catch {
      throw new BadRequestException(
        'Phone call audioUrl must be an absolute HTTP(S) URL.',
      );
    }
  }

  private previewText(value: string, maxLength = 120): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, maxLength - 3)}...`;
  }

  private maskPhone(phoneNumber: string): string {
    return phoneNumber.length > 4
      ? `${phoneNumber.slice(0, 3)}***${phoneNumber.slice(-2)}`
      : phoneNumber;
  }
}
