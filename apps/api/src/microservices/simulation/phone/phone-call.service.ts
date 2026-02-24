import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';
import { PhoneProviderFactory } from './providers/phone.factory';
import { PhoneCallResult, PhoneCallRequest } from './providers/phone.provider';

interface StartPhoneCallInput {
  sessionId: string;
  phoneNumber?: string;
  provider?: string;
  fromNumber?: string;
  userId: string;
}

@Injectable()
export class PhoneCallService {
  private readonly logger = new Logger(PhoneCallService.name);

  constructor(
    private readonly providerFactory: PhoneProviderFactory,
    private readonly prisma: SimulationPrismaService,
    private readonly configService: ConfigService,
  ) {}

  async startCall(input: StartPhoneCallInput): Promise<PhoneCallResult> {
    const { sessionId, provider, phoneNumber, fromNumber, userId } = input;

    const session = await this.prisma.client.session.findUnique({
      where: { id: sessionId },
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
      provider ?? this.resolvePhoneProvider(session.sessionConfig);
    const providerInstance = this.providerFactory.getProvider(resolvedProvider);

    if (providerInstance.name === 'vapi') {
      if (!this.isStrictE164(resolvedNumber)) {
        throw new BadRequestException(
          'Phone number must include a + and country code for Vapi (e.g. +15551234567)',
        );
      }
    } else if (!this.isValidPhoneNumber(resolvedNumber)) {
      throw new BadRequestException(
        'Phone number must be in E.164 format (e.g. +15551234567)',
      );
    }

    const request: PhoneCallRequest = {
      to: resolvedNumber,
      from: fromNumber,
      metadata: { sessionId, userId },
    };

    const providerConfig = this.resolveProviderConfig(session.sessionConfig);
    if (providerConfig) {
      request.providerConfig = providerConfig;
    }

    if (providerInstance.name === 'twilio') {
      request.webhookUrl = this.buildWebhookUrl(sessionId, userId);
    }

    this.logger.log(
      `Starting ${providerInstance.name} call to ${resolvedNumber} for session ${sessionId}`,
    );

    const result = await providerInstance.createCall(request);

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

  private buildWebhookUrl(sessionId: string, userId: string): string {
    const baseUrl = this.configService.get<string>('PHONE_CALL_WEBHOOK_URL');
    if (!baseUrl) {
      throw new Error('PHONE_CALL_WEBHOOK_URL is not configured');
    }

    const url = new URL(baseUrl);
    url.searchParams.set('sessionId', sessionId);
    url.searchParams.set('userId', userId);
    return url.toString();
  }

  private isValidPhoneNumber(value: string): boolean {
    return /^\+?[1-9]\d{7,14}$/.test(value);
  }

  private isStrictE164(value: string): boolean {
    return /^\+[1-9]\d{7,14}$/.test(value);
  }
}
