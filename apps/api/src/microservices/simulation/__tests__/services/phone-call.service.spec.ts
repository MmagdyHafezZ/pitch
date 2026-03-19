import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PhoneCallService } from '../../phone/phone-call.service';

describe('PhoneCallService', () => {
  let service: PhoneCallService;
  let providerFactory: { getProvider: jest.Mock };
  let ttsService: {
    synthesize: jest.Mock;
    synthesizeStream: jest.Mock;
  };
  let prisma: {
    client: {
      session: {
        findUnique: jest.Mock;
        update: jest.Mock;
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
    endCall: jest.Mock;
  };

  const baseSession = {
    id: 'session-1',
    type: 'phone',
    name: 'Verification Call',
    sessionConfig: {},
    persona: null,
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
        raw: {
          monitor: {
            controlUrl: 'https://control.vapi.ai/call-1/control',
            listenUrl: 'wss://control.vapi.ai/call-1/listen',
          },
        },
      }),
      endCall: jest.fn().mockResolvedValue(undefined),
    };
    providerFactory = {
      getProvider: jest.fn().mockReturnValue(provider),
    };
    prisma = {
      client: {
        session: {
          findUnique: jest.fn(),
          update: jest.fn().mockResolvedValue({ id: 'session-1' }),
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
    ttsService = {
      synthesize: jest.fn(),
      synthesizeStream: jest.fn(),
    };

    service = new PhoneCallService(
      providerFactory as any,
      prisma as any,
      vapiContext as any,
      ttsService as any,
    );
  });

  it('builds a text-first playback assistant with a custom voice server', async () => {
    prisma.client.session.findUnique.mockResolvedValue(baseSession);

    const result = await service.startCall({
      sessionId: 'session-1',
      phoneNumber: '+15551234567',
      userId: 'user-1',
      firstMessage: 'Hello, this is your verification call.',
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
            firstMessage: 'Hello, this is your verification call.',
            firstMessageMode: 'assistant-speaks-first',
            modelOutputInMessagesEnabled: false,
            server: {
              url: 'https://api.example.com/api/v1/simulation/phone-calls/vapi/server?token=signed-token',
            },
            voice: {
              provider: 'custom-voice',
              server: {
                url: 'https://api.example.com/api/v1/simulation/phone-calls/vapi/voice?token=signed-token',
              },
            },
            transcriber: expect.objectContaining({
              provider: 'deepgram',
              model: 'nova-2',
            }),
          }),
        }),
      }),
    );

    const createCallInput = provider.createCall.mock.calls[0]?.[0];
    const assistant = createCallInput?.providerConfig?.assistant;
    expect(assistant?.model).toBeUndefined();
    expect(prisma.client.session.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: {
        sessionConfig: expect.objectContaining({
          phone: expect.objectContaining({
            runtime: expect.objectContaining({
              provider: 'vapi',
              callId: 'call-1',
              controlUrl: 'https://control.vapi.ai/call-1/control',
              listenUrl: 'wss://control.vapi.ai/call-1/listen',
              status: 'queued',
            }),
          }),
        }),
      },
    });
    expect(result.sessionId).toBe('session-1');
  });

  it('can end an active phone call through the stored Vapi control URL', async () => {
    prisma.client.session.findUnique.mockResolvedValueOnce({
      ...baseSession,
      sessionConfig: {
        phone: {
          runtime: {
            provider: 'vapi',
            callId: 'call-1',
            controlUrl: 'https://control.vapi.ai/call-1/control',
          },
        },
      },
    });

    const result = await service.endActiveCall({
      sessionId: 'session-1',
      userId: 'user-1',
      reason: 'Scenario completed',
    });

    expect(provider.endCall).toHaveBeenCalledWith({
      callId: 'call-1',
      controlUrl: 'https://control.vapi.ai/call-1/control',
    });
    expect(prisma.client.session.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: {
        sessionConfig: expect.objectContaining({
          phone: expect.objectContaining({
            runtime: expect.objectContaining({
              provider: 'vapi',
              callId: 'call-1',
              controlUrl: 'https://control.vapi.ai/call-1/control',
              endRequestedReason: 'Scenario completed',
            }),
          }),
        }),
      },
    });
    expect(result).toEqual({
      ok: true,
      callId: 'call-1',
      provider: 'vapi',
      sessionId: 'session-1',
    });
  });

  it('uses a session-configured firstMessage when no override is provided', async () => {
    prisma.client.session.findUnique.mockResolvedValue({
      ...baseSession,
      sessionConfig: {
        phone: {
          vapi: {
            firstMessage: 'Please say your verification code now.',
          },
        },
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
            firstMessage: 'Please say your verification code now.',
            firstMessageMode: 'assistant-speaks-first',
            voice: {
              provider: 'custom-voice',
              server: {
                url: 'https://api.example.com/api/v1/simulation/phone-calls/vapi/voice?token=signed-token',
              },
            },
          }),
        }),
      }),
    );
  });

  it('falls back to the scenario description when no explicit firstMessage is configured', async () => {
    prisma.client.session.findUnique.mockResolvedValue({
      ...baseSession,
      name: null,
      scenario: {
        id: 'scenario-1',
        name: 'Verification',
        description: 'Please say your full name after the tone.',
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
            firstMessage: 'Please say your full name after the tone.',
          }),
        }),
      }),
    );
  });

  it('keeps the legacy audioUrl fallback when only an audio URL is configured', async () => {
    prisma.client.session.findUnique.mockResolvedValue({
      ...baseSession,
      name: null,
      scenario: null,
      sessionConfig: {
        phone: {
          vapi: {
            audioUrl: 'https://cdn.example.com/session-audio.mp3',
          },
        },
      },
    });

    await service.startCall({
      sessionId: 'session-1',
      phoneNumber: '+15551234567',
      userId: 'user-1',
    });

    const createCallInput = provider.createCall.mock.calls[0]?.[0];
    expect(createCallInput?.providerConfig?.assistant).toMatchObject({
      firstMessage: 'https://cdn.example.com/session-audio.mp3',
      firstMessageMode: 'assistant-speaks-first',
    });
    expect(createCallInput?.providerConfig?.assistant?.voice).toBeUndefined();
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

  it('synthesizes raw PCM audio with the resolved ElevenLabs voice config', async () => {
    const audioBuffer = Buffer.from([1, 2, 3]);
    prisma.client.session.findUnique.mockResolvedValue({
      ...baseSession,
      sessionConfig: {
        ttsProvider: 'elevenlabs',
        ttsVoice: 'Rachel',
      },
    });
    ttsService.synthesizeStream.mockResolvedValue({
      contentType: 'audio/pcm;rate=24000;channels=1',
      audioStream: (async function* () {
        yield audioBuffer;
      })(),
    });

    const result = await service.synthesizePhoneCallAudio({
      sessionId: 'session-1',
      userId: 'user-1',
      text: 'Hello from PITCH.',
      sampleRate: 24000,
    });

    expect(ttsService.synthesizeStream).toHaveBeenCalledWith(
      'Hello from PITCH.',
      'elevenlabs',
      expect.objectContaining({
        voice: 'Rachel',
        format: 'pcm',
        sampleRate: 24000,
      }),
    );
    expect(result).toEqual({
      audioBuffer,
      contentType: 'audio/pcm;rate=24000;channels=1',
    });
  });

  it('falls back to default ElevenLabs PCM when the resolved provider cannot serve phone audio', async () => {
    prisma.client.session.findUnique.mockResolvedValue({
      ...baseSession,
      sessionConfig: {
        ttsProvider: 'openai',
        ttsVoice: 'alloy',
      },
    });
    ttsService.synthesizeStream.mockRejectedValue(
      new Error('TTS provider "openai" does not support streaming'),
    );
    ttsService.synthesize
      .mockResolvedValueOnce({
        audioBuffer: Buffer.from('mp3'),
        contentType: 'audio/mpeg',
      })
      .mockResolvedValueOnce({
        audioBuffer: Buffer.from([9, 9]),
        contentType: 'audio/pcm;rate=24000;channels=1',
      });

    const result = await service.synthesizePhoneCallAudio({
      sessionId: 'session-1',
      userId: 'user-1',
      text: 'Fallback path',
      sampleRate: 24000,
    });

    expect(ttsService.synthesize).toHaveBeenNthCalledWith(
      1,
      'Fallback path',
      'openai',
      expect.objectContaining({
        voice: 'alloy',
        format: 'pcm',
        sampleRate: 24000,
      }),
    );
    expect(ttsService.synthesize).toHaveBeenNthCalledWith(
      2,
      'Fallback path',
      'elevenlabs',
      expect.objectContaining({
        format: 'pcm',
        sampleRate: 24000,
      }),
    );
    expect(result.contentType).toBe('audio/pcm;rate=24000;channels=1');
  });
});
