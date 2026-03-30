import { TtsService } from '../../tts/tts.service';
import { TtsProviderFactory } from '../../tts/providers/tts.factory';
import type { TtsProvider, TtsResult } from '../../tts/providers/tts.provider';

describe('TtsService', () => {
  let service: TtsService;
  let providerFactory: {
    getProvider: jest.Mock;
    listProviders: jest.Mock;
    getVoices: jest.Mock;
    getModels: jest.Mock;
  };

  let elevenlabsProvider: TtsProvider & {
    synthesize: jest.Mock<Promise<TtsResult>, [string, any?]>;
    synthesizeStream: jest.Mock;
  };
  let melottsProvider: TtsProvider & {
    synthesize: jest.Mock<Promise<TtsResult>, [string, any?]>;
  };

  beforeEach(() => {
    elevenlabsProvider = {
      name: 'elevenlabs',
      synthesize: jest.fn(),
      synthesizeStream: jest.fn(),
    };
    melottsProvider = {
      name: 'melotts',
      synthesize: jest.fn(),
    };

    providerFactory = {
      getProvider: jest.fn((name?: string) => {
        const resolved = name ?? 'elevenlabs';
        if (resolved === 'elevenlabs') {
          return elevenlabsProvider;
        }
        if (resolved === 'melotts') {
          return melottsProvider;
        }
        throw new Error(`TTS provider "${resolved}" not registered`);
      }),
      listProviders: jest.fn().mockReturnValue([]),
      getVoices: jest.fn().mockReturnValue([]),
      getModels: jest.fn().mockReturnValue([]),
    };

    service = new TtsService(providerFactory as unknown as TtsProviderFactory);
  });

  it('falls back to melotts when elevenlabs synthesis fails', async () => {
    elevenlabsProvider.synthesize.mockRejectedValue(new Error('quota reached'));
    melottsProvider.synthesize.mockResolvedValue({
      audioBuffer: Buffer.from([1, 2, 3]),
      contentType: 'audio/mpeg',
    });

    const result = await service.synthesize('hello', 'elevenlabs', {
      voice: 'Bella',
      language: 'en',
    });

    expect(result.audioBuffer.length).toBe(3);
    expect(melottsProvider.synthesize).toHaveBeenCalledWith('hello', {
      voice: 'Bella',
      language: 'en',
    });
  });

  it('does not fall back to melotts for pcm requests', async () => {
    elevenlabsProvider.synthesize.mockRejectedValue(new Error('quota reached'));

    await expect(
      service.synthesize('hello', 'elevenlabs', {
        format: 'pcm',
        sampleRate: 24000,
      }),
    ).rejects.toThrow('quota reached');

    expect(melottsProvider.synthesize).not.toHaveBeenCalled();
  });

  it('falls back to melotts for stream requests when elevenlabs stream fails', async () => {
    elevenlabsProvider.synthesizeStream.mockRejectedValue(
      new Error('stream failed'),
    );
    melottsProvider.synthesize.mockResolvedValue({
      audioBuffer: Buffer.from([4, 5, 6]),
      contentType: 'audio/mpeg',
    });

    const result = await service.synthesizeStream('hello', 'elevenlabs', {
      language: 'en',
    });

    const chunks: number[] = [];
    for await (const chunk of result.audioStream) {
      chunks.push(...Array.from(chunk));
    }

    expect(chunks).toEqual([4, 5, 6]);
    expect(result.contentType).toBe('audio/mpeg');
  });
});
