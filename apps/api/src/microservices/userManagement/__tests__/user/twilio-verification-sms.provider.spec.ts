import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { TwilioVerificationSmsProvider } from '../../user/services/providers/twilio-verification-sms.provider';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

describe('TwilioVerificationSmsProvider', () => {
  let provider: TwilioVerificationSmsProvider;

  const configValues: Record<string, string> = {
    TWILIO_ACCOUNT_SID: 'AC1234567890abcdef1234567890abcd',
    TWILIO_AUTH_TOKEN: 'twilio-auth-token',
    TWILIO_FROM_NUMBER: '+17822026330',
  };

  beforeEach(() => {
    mockAxios.post.mockResolvedValue({
      data: {
        sid: 'SM1234567890abcdef1234567890abcdef',
        status: 'queued',
      },
    });

    const configService = {
      get: jest.fn((key: string) => configValues[key]),
    } as unknown as ConfigService;

    provider = new TwilioVerificationSmsProvider(configService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sends a verification message through Twilio', async () => {
    await provider.sendMessage({
      phoneNumber: '+15551234567',
      message: 'Your PITCH verification code is 123456.',
      userId: 'user-1',
    });

    expect(mockAxios.post).toHaveBeenCalledWith(
      'https://api.twilio.com/2010-04-01/Accounts/AC1234567890abcdef1234567890abcd/Messages.json',
      expect.stringContaining('To=%2B15551234567'),
      expect.objectContaining({
        auth: {
          username: 'AC1234567890abcdef1234567890abcd',
          password: 'twilio-auth-token',
        },
      }),
    );
  });

  it('validates startup configuration', () => {
    expect(() => provider.assertConfigured()).not.toThrow();
  });

  it('rejects invalid from numbers during startup validation', () => {
    const brokenConfig = {
      get: jest.fn((key: string) =>
        key === 'TWILIO_FROM_NUMBER' ? '555' : configValues[key],
      ),
    } as unknown as ConfigService;

    const brokenProvider = new TwilioVerificationSmsProvider(brokenConfig);

    expect(() => brokenProvider.assertConfigured()).toThrow(
      BadRequestException,
    );
  });
});
