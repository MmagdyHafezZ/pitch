import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  SmsMessageRequest,
  VerificationSmsSender,
} from './verification-sms.provider';

type SmsProviderAuth = {
  username: string;
  password: string;
};

@Injectable()
export class TwilioVerificationSmsProvider implements VerificationSmsSender {
  private readonly logger = new Logger(TwilioVerificationSmsProvider.name);

  constructor(private readonly configService: ConfigService) {}

  assertConfigured(): void {
    this.getTwilioAccountSid();
    this.getTwilioAuth();
    this.getTwilioFromNumber();
  }

  async sendMessage(input: SmsMessageRequest): Promise<void> {
    const accountSid = this.getTwilioAccountSid();
    const requestUrl = new URL(
      `/2010-04-01/Accounts/${accountSid}/Messages.json`,
      this.getTwilioBaseUrl(),
    ).toString();
    const body = new URLSearchParams({
      To: input.phoneNumber,
      From: this.getTwilioFromNumber(),
      Body: input.message,
    });

    try {
      await axios.post(requestUrl, body.toString(), {
        auth: this.getTwilioAuth(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 20_000,
      });
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? this.extractAxiosErrorMessage(error)
        : (error as Error)?.message;
      this.logger.error(
        `phone_verification.sms_failed user=${input.userId} phone=${this.maskPhone(input.phoneNumber)} error=${message ?? 'unknown'}`,
      );
      throw this.toSmsDeliveryException(
        error,
        'Unable to send the verification challenge right now.',
      );
    }
  }

  private extractAxiosErrorMessage(error: unknown): string | undefined {
    if (!axios.isAxiosError(error)) {
      return undefined;
    }

    const responseData = error.response?.data;
    if (
      responseData &&
      typeof responseData === 'object' &&
      typeof (responseData as Record<string, unknown>).message === 'string'
    ) {
      return (responseData as Record<string, string>).message;
    }

    return error.message;
  }

  private getTwilioBaseUrl(): string {
    return (
      this.configService.get<string>('TWILIO_BASE_URL') ??
      'https://api.twilio.com'
    );
  }

  private getTwilioAccountSid(): string {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');

    if (!accountSid || accountSid.trim().length === 0) {
      throw new Error(
        'TWILIO_ACCOUNT_SID is required for phone verification SMS.',
      );
    }

    return accountSid.trim();
  }

  private getTwilioFromNumber(): string {
    const rawFromNumber = this.configService.get<string>('TWILIO_FROM_NUMBER');

    if (!rawFromNumber || rawFromNumber.trim().length === 0) {
      throw new Error(
        'TWILIO_FROM_NUMBER is required for phone verification SMS.',
      );
    }

    return this.normalizePhoneNumber(rawFromNumber);
  }

  private getTwilioAuth(): SmsProviderAuth {
    const apiKeySid = this.configService.get<string>('TWILIO_API_KEY_SID');
    const apiKeySecret = this.configService.get<string>(
      'TWILIO_API_KEY_SECRET',
    );

    if (apiKeySid && apiKeySecret) {
      return {
        username: apiKeySid,
        password: apiKeySecret,
      };
    }

    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

    if (accountSid && authToken) {
      return {
        username: accountSid,
        password: authToken,
      };
    }

    throw new Error(
      'Twilio SMS credentials are required. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN, or TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET.',
    );
  }

  private normalizePhoneNumber(raw: string): string {
    const value = raw.trim();
    if (!value) {
      throw new BadRequestException('Phone number is required');
    }

    let normalized = value.replace(/[^\d+]/g, '');

    if (normalized.startsWith('00')) {
      normalized = `+${normalized.slice(2)}`;
    }

    if (normalized.startsWith('+')) {
      normalized = `+${normalized.slice(1).replace(/\D/g, '')}`;
    } else {
      const digits = normalized.replace(/\D/g, '');
      if (digits.length === 10) {
        normalized = `+1${digits}`;
      } else if (digits.length === 11 && digits.startsWith('1')) {
        normalized = `+${digits}`;
      } else {
        throw new BadRequestException(
          'Enter a valid phone number with country code (for example +15551234567).',
        );
      }
    }

    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      throw new BadRequestException(
        'Enter a valid phone number in E.164 format (for example +15551234567).',
      );
    }

    return normalized;
  }

  private maskPhone(phoneNumber: string): string {
    if (phoneNumber.length <= 4) {
      return phoneNumber;
    }

    return `${phoneNumber.slice(0, 3)}***${phoneNumber.slice(-2)}`;
  }

  private toSmsDeliveryException(
    error: unknown,
    fallbackMessage: string,
  ): HttpException {
    const message = axios.isAxiosError(error)
      ? this.extractAxiosErrorMessage(error)
      : (error as Error)?.message;
    const status = axios.isAxiosError(error) ? error.response?.status : null;

    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      return new HttpException(
        message ?? fallbackMessage,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (status && status >= 400 && status < 500) {
      return new BadRequestException(message ?? fallbackMessage);
    }

    return new ServiceUnavailableException(message ?? fallbackMessage);
  }
}
