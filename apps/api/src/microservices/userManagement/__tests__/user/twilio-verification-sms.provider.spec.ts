import {
  BadRequestException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { TwilioVerificationSmsProvider } from '../../user/services/providers/twilio-verification-sms.provider';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

function makeConfigService(values: Record<string, string | undefined> = {}) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

const baseConfig: Record<string, string> = {
  TWILIO_ACCOUNT_SID: 'AC123',
  TWILIO_AUTH_TOKEN: 'auth-token',
  TWILIO_FROM_NUMBER: '+15551234567',
};

describe('TwilioVerificationSmsProvider', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('assertConfigured', () => {
    it('succeeds when all required config is present', () => {
      const provider = new TwilioVerificationSmsProvider(
        makeConfigService(baseConfig),
      );

      expect(() => provider.assertConfigured()).not.toThrow();
    });

    it('throws when TWILIO_ACCOUNT_SID is missing', () => {
      const config = { ...baseConfig, TWILIO_ACCOUNT_SID: undefined };
      const provider = new TwilioVerificationSmsProvider(
        makeConfigService(config),
      );

      expect(() => provider.assertConfigured()).toThrow('TWILIO_ACCOUNT_SID');
    });

    it('throws when TWILIO_FROM_NUMBER is missing', () => {
      const config = { ...baseConfig, TWILIO_FROM_NUMBER: undefined };
      const provider = new TwilioVerificationSmsProvider(
        makeConfigService(config),
      );

      expect(() => provider.assertConfigured()).toThrow('TWILIO_FROM_NUMBER');
    });

    it('throws when both auth methods are missing', () => {
      const config = { ...baseConfig, TWILIO_AUTH_TOKEN: undefined };
      const provider = new TwilioVerificationSmsProvider(
        makeConfigService(config),
      );

      expect(() => provider.assertConfigured()).toThrow(
        'credentials are required',
      );
    });
  });

  describe('sendMessage', () => {
    it('sends an SMS via Twilio API', async () => {
      mockedAxios.post.mockResolvedValue({ data: { sid: 'msg-1' } });
      const provider = new TwilioVerificationSmsProvider(
        makeConfigService(baseConfig),
      );

      await provider.sendMessage({
        phoneNumber: '+15559876543',
        message: 'Code: 1234',
        userId: 'user-1',
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('AC123/Messages.json'),
        expect.any(String),
        expect.objectContaining({
          auth: { username: 'AC123', password: 'auth-token' },
        }),
      );
    });

    it('uses API key credentials when available', async () => {
      mockedAxios.post.mockResolvedValue({ data: {} });
      const config = {
        ...baseConfig,
        TWILIO_API_KEY_SID: 'SK123',
        TWILIO_API_KEY_SECRET: 'secret',
      };
      const provider = new TwilioVerificationSmsProvider(
        makeConfigService(config),
      );

      await provider.sendMessage({
        phoneNumber: '+15559876543',
        message: 'Code: 1234',
        userId: 'user-1',
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          auth: { username: 'SK123', password: 'secret' },
        }),
      );
    });

    it('throws ServiceUnavailableException for server errors', async () => {
      const axiosErr = {
        isAxiosError: true,
        response: { status: 500, data: { message: 'server error' } },
        message: 'Request failed',
      };
      mockedAxios.post.mockRejectedValue(axiosErr);
      mockedAxios.isAxiosError.mockReturnValue(true);

      const provider = new TwilioVerificationSmsProvider(
        makeConfigService(baseConfig),
      );

      await expect(
        provider.sendMessage({
          phoneNumber: '+15559876543',
          message: 'Code: 1234',
          userId: 'user-1',
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws HttpException with 429 for rate limiting', async () => {
      const axiosErr = {
        isAxiosError: true,
        response: { status: 429, data: { message: 'rate limited' } },
        message: 'Too many requests',
      };
      mockedAxios.post.mockRejectedValue(axiosErr);
      mockedAxios.isAxiosError.mockReturnValue(true);

      const provider = new TwilioVerificationSmsProvider(
        makeConfigService(baseConfig),
      );

      await expect(
        provider.sendMessage({
          phoneNumber: '+15559876543',
          message: 'Code: 1234',
          userId: 'user-1',
        }),
      ).rejects.toThrow(HttpException);

      try {
        await provider.sendMessage({
          phoneNumber: '+15559876543',
          message: 'Code: 1234',
          userId: 'user-1',
        });
      } catch (e) {
        expect((e as HttpException).getStatus()).toBe(
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    });

    it('throws BadRequestException for 4xx client errors', async () => {
      const axiosErr = {
        isAxiosError: true,
        response: { status: 400, data: { message: 'invalid number' } },
        message: 'Bad Request',
      };
      mockedAxios.post.mockRejectedValue(axiosErr);
      mockedAxios.isAxiosError.mockReturnValue(true);

      const provider = new TwilioVerificationSmsProvider(
        makeConfigService(baseConfig),
      );

      await expect(
        provider.sendMessage({
          phoneNumber: '+15559876543',
          message: 'Code: 1234',
          userId: 'user-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ServiceUnavailableException for non-axios errors', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'));
      mockedAxios.isAxiosError.mockReturnValue(false);

      const provider = new TwilioVerificationSmsProvider(
        makeConfigService(baseConfig),
      );

      await expect(
        provider.sendMessage({
          phoneNumber: '+15559876543',
          message: 'Test',
          userId: 'user-1',
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('phone number normalization (via sendMessage)', () => {
    beforeEach(() => {
      mockedAxios.post.mockResolvedValue({ data: {} });
    });

    it('normalizes a 10-digit number by prepending +1', async () => {
      const provider = new TwilioVerificationSmsProvider(
        makeConfigService({ ...baseConfig, TWILIO_FROM_NUMBER: '5551234567' }),
      );

      await provider.sendMessage({
        phoneNumber: '+15559876543',
        message: 'test',
        userId: 'u1',
      });

      const body = mockedAxios.post.mock.calls[0][1] as string;
      expect(body).toContain('From=%2B15551234567');
    });

    it('normalizes numbers starting with 00', async () => {
      const provider = new TwilioVerificationSmsProvider(
        makeConfigService({
          ...baseConfig,
          TWILIO_FROM_NUMBER: '0015551234567',
        }),
      );

      await provider.sendMessage({
        phoneNumber: '+15559876543',
        message: 'test',
        userId: 'u1',
      });

      const body = mockedAxios.post.mock.calls[0][1] as string;
      expect(body).toContain('From=%2B15551234567');
    });

    it('throws for invalid short numbers', () => {
      const provider = new TwilioVerificationSmsProvider(
        makeConfigService({ ...baseConfig, TWILIO_FROM_NUMBER: '12345' }),
      );

      expect(() => provider.assertConfigured()).toThrow(BadRequestException);
    });
  });
});
