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

interface StartPhoneCallInput {
  sessionId: string;
  phoneNumber?: string;
  provider?: string;
  userId: string;
}

@Injectable()
export class PhoneCallService {
  private readonly logger = new Logger(PhoneCallService.name);

  constructor(
    private readonly providerFactory: PhoneProviderFactory,
    private readonly prisma: SimulationPrismaService,
    private readonly vapiContext: VapiContextService,
  ) {}

  async startCall(input: StartPhoneCallInput): Promise<PhoneCallResult> {
    const { sessionId, provider, phoneNumber, userId } = input;

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

    request.providerConfig = this.buildVapiProviderConfig(session, userId);

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
      persona?: { name: string; traits?: unknown } | null;
    },
    userId: string,
  ): Record<string, unknown> {
    const sessionConfigRecord = this.resolveRecord(session.sessionConfig) ?? {};
    const phoneConfig = this.resolvePhoneConfig(session.sessionConfig);
    const existingProviderConfig =
      this.resolveProviderConfig(session.sessionConfig) ?? {};
    const vapiConfig = this.resolveNestedObject(phoneConfig, 'vapi') ?? {};
    const personaTraits =
      this.resolveNestedObject(session.persona, 'traits') ?? {};
    const personaVoice = this.resolveNestedObject(personaTraits, 'voice') ?? {};

    const token = this.vapiContext.createToken({
      sessionId: session.id,
      userId,
      purpose: 'phone-call',
    });

    const llmUrl = this.vapiContext.buildGatewayUrl(
      'simulation/phone-calls/vapi/llm/chat/completions',
      token,
    );
    const serverUrl = this.vapiContext.buildGatewayUrl(
      'simulation/phone-calls/vapi/server',
      token,
    );

    const modelConfig = this.resolveNestedObject(vapiConfig, 'model') ?? {};
    const transcriberConfig =
      this.resolveNestedObject(vapiConfig, 'transcriber') ?? {};
    const voiceConfig = this.resolveNestedObject(vapiConfig, 'voice') ?? {};
    const sessionVoice =
      this.resolveNestedObject(sessionConfigRecord, 'voice') ?? {};

    const resolvedVoiceProvider = this.normalizeVapiVoiceProvider(
      this.resolveString(voiceConfig, 'provider') ??
        this.resolveString(vapiConfig, 'voiceProvider') ??
        this.resolveString(sessionVoice, 'provider') ??
        this.resolveString(sessionConfigRecord, 'ttsProvider') ??
        this.resolveString(personaVoice, 'provider') ??
        'elevenlabs',
    );
    const resolvedVoiceId =
      this.resolveString(voiceConfig, 'voiceId') ??
      this.resolveString(vapiConfig, 'voiceId') ??
      this.resolveString(sessionVoice, 'voiceId') ??
      this.resolveString(sessionVoice, 'voice') ??
      this.resolveString(sessionConfigRecord, 'ttsVoice') ??
      this.resolveString(personaVoice, 'voiceId') ??
      this.resolveString(personaVoice, 'voiceName') ??
      this.resolveString(personaVoice, 'voice');

    if (!resolvedVoiceId) {
      throw new BadRequestException(
        'Phone session voice must be configured on the session or persona.',
      );
    }

    const assistant = {
      name:
        this.resolveString(vapiConfig, 'name') ??
        session.name ??
        (session.persona?.name
          ? `PITCH ${session.persona.name}`
          : 'PITCH Phone Session'),
      firstMessageMode:
        this.resolveString(vapiConfig, 'firstMessageMode') ??
        'assistant-speaks-first-with-model-generated-message',
      maxDurationSeconds:
        this.resolveNumber(vapiConfig, 'maxDurationSeconds') ?? 900,
      modelOutputInMessagesEnabled:
        this.resolveBoolean(vapiConfig, 'modelOutputInMessagesEnabled') ?? true,
      server: {
        url: serverUrl,
      },
      serverMessages: this.resolveStringArray(vapiConfig, 'serverMessages') ?? [
        'status-update',
        'speech-update',
        'transcript',
        'conversation-update',
        'model-output',
        'tool-calls',
        'end-of-call-report',
        'hang',
      ],
      model: {
        provider: this.resolveString(modelConfig, 'provider') ?? 'custom-llm',
        model: this.resolveString(modelConfig, 'model') ?? 'pitch-phone-engine',
        url: llmUrl,
        tools: [{ type: 'endCall' }],
        messages: [
          {
            role: 'system',
            content:
              'Use the external custom LLM endpoint as the source of truth for all phone-call replies. Keep answers concise, natural, and optimized for live speech.',
          },
        ],
      },
      transcriber: {
        provider:
          this.resolveString(transcriberConfig, 'provider') ?? 'deepgram',
        model: this.resolveString(transcriberConfig, 'model') ?? 'nova-2',
      },
      voice: {
        provider: resolvedVoiceProvider,
        voiceId: resolvedVoiceId,
      },
    };

    return {
      ...existingProviderConfig,
      ...vapiConfig,
      assistant,
    };
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

  private normalizeVapiVoiceProvider(provider: string): string {
    const normalized = provider.trim().toLowerCase();

    switch (normalized) {
      case 'elevenlabs':
      case 'eleven-labs':
      case '11labs':
        return '11labs';
      case 'play.ht':
        return 'playht';
      default:
        return normalized;
    }
  }

  private resolveRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : undefined;
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

  private resolveBoolean(
    source: Record<string, unknown> | undefined,
    key: string,
  ): boolean | undefined {
    if (!source) {
      return undefined;
    }

    const value = source[key];
    return typeof value === 'boolean' ? value : undefined;
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

  private maskPhone(phoneNumber: string): string {
    return phoneNumber.length > 4
      ? `${phoneNumber.slice(0, 3)}***${phoneNumber.slice(-2)}`
      : phoneNumber;
  }
}
