import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PhoneCallService } from '../../phone/phone-call.service';

describe('PhoneCallService', () => {
  let service: PhoneCallService;
  let providerFactory: { getProvider: jest.Mock };
  let prisma: {
    client: {
      session: {
        findUnique: jest.Mock;
      };
    };
  };
  let vapiContext: {
    createToken: jest.Mock;
    buildGatewayUrl: jest.Mock;
  };
  let provider: {
    name: string;
    createCall: jest.Mock;
  };

  const baseSession = {
    id: 'session-1',
    type: 'phone',
    name: 'Discovery Call',
    sessionConfig: {},
    persona: {
      name: 'Morgan',
      traits: {
        voice: {
          provider: 'elevenlabs',
          voiceName: 'Persona Voice',
        },
      },
    },
    scenario: null,
  };

  beforeEach(() => {
    provider = {
      name: 'vapi',
      createCall: jest.fn().mockResolvedValue({
        provider: 'vapi',
        callId: 'call-1',
        status: 'queued',
        to: '+15551234567',
        from: 'phone-number-id',
      }),
    };
    providerFactory = {
      getProvider: jest.fn().mockReturnValue(provider),
    };
    prisma = {
      client: {
        session: {
          findUnique: jest.fn(),
        },
      },
    };
    vapiContext = {
      createToken: jest.fn().mockReturnValue('signed-token'),
      buildGatewayUrl: jest
        .fn()
        .mockImplementation(
          (path: string, token: string) =>
            `https://api.example.com/api/v1/${path}?token=${token}`,
        ),
    };

    service = new PhoneCallService(
      providerFactory as any,
      prisma as any,
      vapiContext as any,
    );
  });

  it('builds a Vapi custom-LLM assistant using the session-selected voice', async () => {
    prisma.client.session.findUnique.mockResolvedValue({
      ...baseSession,
      sessionConfig: {
        voice: {
          provider: 'elevenlabs',
          voice: 'Voice-42',
        },
        phone: {
          vapi: {
            maxDurationSeconds: 120,
            model: { model: 'pitch-override' },
          },
        },
      },
    });

    const result = await service.startCall({
      sessionId: 'session-1',
      phoneNumber: '+15551234567',
      userId: 'user-1',
    });

    expect(vapiContext.createToken).toHaveBeenCalledWith({
      sessionId: 'session-1',
      userId: 'user-1',
      purpose: 'phone-call',
    });
    expect(provider.createCall).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '+15551234567',
        metadata: {
          sessionId: 'session-1',
          userId: 'user-1',
          transport: 'vapi',
        },
        providerConfig: expect.objectContaining({
          assistant: expect.objectContaining({
            maxDurationSeconds: 120,
            server: {
              url: 'https://api.example.com/api/v1/simulation/phone-calls/vapi/server?token=signed-token',
            },
            model: expect.objectContaining({
              provider: 'custom-llm',
              model: 'pitch-override',
              url: 'https://api.example.com/api/v1/simulation/phone-calls/vapi/llm/chat/completions?token=signed-token',
              tools: [{ type: 'endCall' }],
            }),
            voice: expect.objectContaining({
              provider: '11labs',
              voiceId: 'Voice-42',
            }),
          }),
        }),
      }),
    );
    expect(result.sessionId).toBe('session-1');
  });

  it('uses the session-configured phone number when an explicit number is not provided', async () => {
    prisma.client.session.findUnique.mockResolvedValue({
      ...baseSession,
      sessionConfig: {
        phoneNumber: '+15550001111',
      },
    });

    await service.startCall({
      sessionId: 'session-1',
      userId: 'user-1',
    });

    expect(provider.createCall).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '+15550001111',
      }),
    );
  });

  it('rejects unknown sessions', async () => {
    prisma.client.session.findUnique.mockResolvedValue(null);

    await expect(
      service.startCall({
        sessionId: 'missing',
        phoneNumber: '+15551234567',
        userId: 'user-1',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects non-phone sessions', async () => {
    prisma.client.session.findUnique.mockResolvedValue({
      ...baseSession,
      type: 'voice',
    });

    await expect(
      service.startCall({
        sessionId: 'session-1',
        phoneNumber: '+15551234567',
        userId: 'user-1',
      }),
    ).rejects.toThrow('Session session-1 is not a phone call session');
  });

  it('rejects invalid phone numbers before calling Vapi', async () => {
    prisma.client.session.findUnique.mockResolvedValue(baseSession);

    await expect(
      service.startCall({
        sessionId: 'session-1',
        phoneNumber: '5551234567',
        userId: 'user-1',
      }),
    ).rejects.toThrow(
      'Phone number must be in E.164 format (for example +15551234567).',
    );

    expect(provider.createCall).not.toHaveBeenCalled();
  });

  it('rejects non-Vapi providers from config or input', async () => {
    prisma.client.session.findUnique.mockResolvedValue({
      ...baseSession,
      sessionConfig: {
        phoneProvider: 'twilio',
      },
    });

    await expect(
      service.startCall({
        sessionId: 'session-1',
        phoneNumber: '+15551234567',
        userId: 'user-1',
      }),
    ).rejects.toThrow('Only Vapi is supported for phone calls.');

    await expect(
      service.startCall({
        sessionId: 'session-1',
        phoneNumber: '+15551234567',
        provider: 'twilio',
        userId: 'user-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects phone calls when no session or persona voice is configured', async () => {
    prisma.client.session.findUnique.mockResolvedValue({
      ...baseSession,
      sessionConfig: {},
      persona: null,
    });

    await expect(
      service.startCall({
        sessionId: 'session-1',
        phoneNumber: '+15551234567',
        userId: 'user-1',
      }),
    ).rejects.toThrow(
      'Phone session voice must be configured on the session or persona.',
    );

    expect(provider.createCall).not.toHaveBeenCalled();
  });

  it('maps elevenlabs voice providers to the Vapi 11labs key', async () => {
    prisma.client.session.findUnique.mockResolvedValue({
      ...baseSession,
      sessionConfig: {
        ttsProvider: 'elevenlabs',
        ttsVoice: 'Voice-42',
      },
    });

    await service.startCall({
      sessionId: 'session-1',
      phoneNumber: '+15551234567',
      userId: 'user-1',
    });

    expect(provider.createCall).toHaveBeenCalledWith(
      expect.objectContaining({
        providerConfig: expect.objectContaining({
          assistant: expect.objectContaining({
            voice: expect.objectContaining({
              provider: '11labs',
              voiceId: 'Voice-42',
            }),
          }),
        }),
      }),
    );
  });
});
