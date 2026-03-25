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

  getReachablePublicApiBaseUrl(): string {
    const value = this.getPublicApiBaseUrl();

    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new InternalServerErrorException(
        'PUBLIC_API_BASE_URL or API_BASE_URL must be a valid absolute URL for Vapi call routing.',
      );
    }

    if (!this.isPubliclyReachableHost(url.hostname)) {
      throw new InternalServerErrorException(
        `Vapi phone calls require PUBLIC_API_BASE_URL or API_BASE_URL to be publicly reachable from Vapi. "${url.hostname}" is not reachable from Vapi; use your deployed API URL or a tunnel such as ngrok.`,
      );
    }

    return url.toString();
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

  private isPubliclyReachableHost(hostname: string): boolean {
    const normalized = hostname.trim().toLowerCase();

    if (
      normalized === 'localhost' ||
      normalized === '0.0.0.0' ||
      normalized === '127.0.0.1' ||
      normalized === '::1' ||
      normalized.endsWith('.local')
    ) {
      return false;
    }

    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized)) {
      return false;
    }

    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(normalized)) {
      return false;
    }

    const match172 = normalized.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
    if (match172) {
      const secondOctet = Number(match172[1]);
      if (secondOctet >= 16 && secondOctet <= 31) {
        return false;
      }
    }

    return true;
  }

  private require(key: string, message: string): string {
    const value = this.configService.get<string>(key);
    if (!value || value.trim().length === 0) {
      throw new InternalServerErrorException(message);
    }

    return value;
  }
}
