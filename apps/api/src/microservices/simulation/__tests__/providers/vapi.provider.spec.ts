import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { VapiConfigService } from '../../phone/vapi-config.service';
import { VapiPhoneProvider } from '../../phone/providers/vapi.provider';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

describe('VapiPhoneProvider', () => {
  let provider: VapiPhoneProvider;
  let configService: jest.Mocked<ConfigService>;
  let vapiConfig: VapiConfigService;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'VAPI_API_KEY') return 'vapi-key';
        if (key === 'VAPI_PHONE_NUMBER_ID') return 'phone-number-id';
        if (key === 'VAPI_BASE_URL') return 'https://api.vapi.ai';
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    vapiConfig = new VapiConfigService(
      configService as unknown as ConfigService,
    );
    provider = new VapiPhoneProvider(vapiConfig);
    mockAxios.post.mockResolvedValue({
      data: { id: 'call-1', status: 'queued' },
    });
    mockAxios.isAxiosError.mockReturnValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('requires explicit inline assistant config', async () => {
    await expect(
      provider.createCall({
        to: '+15551234567',
      }),
    ).rejects.toThrow(
      'Vapi assistant config is required for phone calls. Hosted assistant IDs are not supported.',
    );
  });

  it('creates a call successfully and prefers providerConfig phoneNumberId overrides', async () => {
    const result = await provider.createCall({
      to: '+15551234567',
      metadata: { sessionId: 'session-1' },
      providerConfig: {
        phoneNumberId: 'override-phone-number-id',
        assistant: {
          name: 'PITCH Phone',
        },
      },
    });

    expect(mockAxios.post).toHaveBeenCalledWith(
      'https://api.vapi.ai/call/phone',
      expect.objectContaining({
        phoneNumberId: 'override-phone-number-id',
        customer: { number: '+15551234567' },
        metadata: { sessionId: 'session-1' },
      }),
      expect.any(Object),
    );
    expect(result).toEqual(
      expect.objectContaining({
        provider: 'vapi',
        callId: 'call-1',
        status: 'queued',
        from: 'override-phone-number-id',
      }),
    );
  });

  it('surfaces Vapi transport failures as HttpException', async () => {
    mockAxios.isAxiosError.mockReturnValue(true);
    mockAxios.post.mockRejectedValue({
      response: {
        status: 503,
        data: { message: 'Vapi unavailable' },
      },
    });

    let thrown: HttpException | null = null;
    try {
      await provider.createCall({
        to: '+15551234567',
        providerConfig: {
          assistant: {
            name: 'PITCH Phone',
          },
        },
      });
    } catch (error) {
      thrown = error as HttpException;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect(thrown?.message).toBe('Vapi unavailable');
    expect(thrown?.getStatus()).toBe(503);
  });

  it('adds guidance when Vapi rejects an international call from a free number', async () => {
    mockAxios.isAxiosError.mockReturnValue(true);
    mockAxios.post.mockRejectedValue({
      response: {
        status: 400,
        data: {
          message: 'Free Vapi numbers do not support international calls.',
        },
      },
    });

    let thrown: HttpException | null = null;
    try {
      await provider.createCall({
        to: '+15875550123',
        providerConfig: {
          assistant: {
            name: 'PITCH Phone',
          },
        },
      });
    } catch (error) {
      thrown = error as HttpException;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect(thrown?.message).toContain(
      'Free Vapi numbers do not support international calls.',
    );
    expect(thrown?.message).toContain('VAPI_PHONE_NUMBER_ID');
    expect(thrown?.getStatus()).toBe(400);
  });

  it('throws when Vapi responds without a call id', async () => {
    mockAxios.post.mockResolvedValue({
      data: { status: 'queued' },
    });

    await expect(
      provider.createCall({
        to: '+15551234567',
        providerConfig: {
          assistant: { name: 'PITCH Phone' },
        },
      }),
    ).rejects.toThrow('Vapi call did not return a call id');
  });

  it('does not accept hosted assistant ids as a fallback', async () => {
    await expect(
      provider.createCall({
        to: '+15551234567',
        providerConfig: {
          assistantId: 'assistant-1',
        },
      }),
    ).rejects.toThrow(
      'Vapi assistant config is required for phone calls. Hosted assistant IDs are not supported.',
    );
  });
});
