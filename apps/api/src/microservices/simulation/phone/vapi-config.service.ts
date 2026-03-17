import {
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VapiConfigService implements OnModuleInit {
  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.getApiKey();
    this.getPhoneNumberId();
    this.getPublicApiBaseUrl();
    this.getContextSecret();
  }

  getApiKey(): string {
    return this.require('VAPI_API_KEY', 'Vapi API key is not configured');
  }

  getPhoneNumberId(): string {
    return this.require(
      'VAPI_PHONE_NUMBER_ID',
      'Vapi phoneNumberId is required',
    );
  }

  getHostedAssistantId(): string | undefined {
    return this.configService.get<string>('VAPI_ASSISTANT_ID');
  }

  allowHostedAssistantFallback(): boolean {
    const explicit = this.configService.get<string>(
      'VAPI_ALLOW_HOSTED_ASSISTANT_FALLBACK',
    );
    if (explicit != null) {
      return explicit === 'true';
    }

    return Boolean(this.getHostedAssistantId());
  }

  getCallUrl(): string {
    const explicitUrl = this.configService.get<string>('VAPI_CALL_URL');
    if (explicitUrl) {
      return explicitUrl;
    }

    return new URL('/call/phone', this.getBaseUrl()).toString();
  }

  getPublicApiBaseUrl(): string {
    const value =
      this.configService.get<string>('PUBLIC_API_BASE_URL') ??
      this.configService.get<string>('API_BASE_URL');

    if (!value || value.trim().length === 0) {
      throw new InternalServerErrorException(
        'PUBLIC_API_BASE_URL or API_BASE_URL is required for Vapi call routing.',
      );
    }

    return value.trim();
  }

  getContextSecret(): string {
    const value =
      this.configService.get<string>('VAPI_CONTEXT_SECRET') ??
      this.configService.get<string>('JWT_SECRET');

    if (!value || value.trim().length === 0) {
      throw new InternalServerErrorException(
        'VAPI_CONTEXT_SECRET or JWT_SECRET is required for Vapi request signing.',
      );
    }

    return value.trim();
  }

  private getBaseUrl(): string {
    return (
      this.configService.get<string>('VAPI_BASE_URL') ?? 'https://api.vapi.ai'
    );
  }

  private require(key: string, message: string): string {
    const value = this.configService.get<string>(key);
    if (!value || value.trim().length === 0) {
      throw new InternalServerErrorException(message);
    }

    return value;
  }
}
