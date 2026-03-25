import { TtsService } from '../../tts/tts.service';

// ---------------------------------------------------------------------------
// Helper: build a minimal TtsProviderFactory mock
// ---------------------------------------------------------------------------

const makeProvider = (
  overrides: {
    name?: string;
    voices?: string[];
    models?: string[];
    synthesize?: jest.Mock;
    synthesizeStream?: jest.Mock | undefined;
  } = {},
) => ({
  name: overrides.name ?? 'mock-provider',
  description: 'Mock Provider',
  voices: overrides.voices ?? ['voice-1'],
  models: overrides.models ?? ['model-1'],
  synthesize: overrides.synthesize ?? jest.fn(),
  ...(overrides.synthesizeStream !== undefined
    ? { synthesizeStream: overrides.synthesizeStream }
    : { synthesizeStream: jest.fn() }),
});

const makeFactory = (provider: ReturnType<typeof makeProvider>) => ({
  getProvider: jest.fn().mockReturnValue(provider),
  listProviders: jest.fn().mockReturnValue([
    { name: 'elevenlabs', description: 'ElevenLabs', voices: [], models: [] },
    {
      name: 'openai',
      description: 'OpenAI TTS',
      voices: ['alloy'],
      models: ['tts-1'],
    },
  ]),
  getVoices: jest.fn().mockReturnValue(provider.voices),
  getModels: jest.fn().mockReturnValue(provider.models),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TtsService', () => {
  describe('synthesize', () => {
    it('delegates to provider.synthesize and returns the result', async () => {
      const expected = {
        audioBuffer: Buffer.from([1, 2, 3]),
        contentType: 'audio/mpeg',
      };
      const synthesize = jest.fn().mockResolvedValue(expected);
      const provider = makeProvider({ synthesize });
      const factory = makeFactory(provider);
      const service = new TtsService(factory as any);

      const result = await service.synthesize('hello world', 'elevenlabs');

      expect(factory.getProvider).toHaveBeenCalledWith('elevenlabs');
      expect(synthesize).toHaveBeenCalledWith('hello world', undefined);
      expect(result).toEqual(expected);
    });

    it('passes options to provider.synthesize', async () => {
      const synthesize = jest.fn().mockResolvedValue({
        audioBuffer: Buffer.from([]),
        contentType: 'audio/mpeg',
      });
      const provider = makeProvider({ synthesize });
      const factory = makeFactory(provider);
      const service = new TtsService(factory as any);
      const options = { voice: 'alloy', format: 'mp3' as const };

      await service.synthesize('test', 'openai', options);

      expect(synthesize).toHaveBeenCalledWith('test', options);
    });

    it('calls getProvider with undefined when no provider name given', async () => {
      const synthesize = jest.fn().mockResolvedValue({
        audioBuffer: Buffer.from([]),
        contentType: 'audio/mpeg',
      });
      const factory = makeFactory(makeProvider({ synthesize }));
      const service = new TtsService(factory as any);

      await service.synthesize('hello');

      expect(factory.getProvider).toHaveBeenCalledWith(undefined);
    });

    it('propagates errors from provider.synthesize', async () => {
      const synthesize = jest.fn().mockRejectedValue(new Error('TTS failed'));
      const factory = makeFactory(makeProvider({ synthesize }));
      const service = new TtsService(factory as any);

      await expect(service.synthesize('hello', 'openai')).rejects.toThrow(
        'TTS failed',
      );
    });

    it('propagates errors from factory.getProvider', async () => {
      const factory = makeFactory(makeProvider());
      factory.getProvider.mockImplementation(() => {
        throw new Error('Provider "unknown" not registered');
      });
      const service = new TtsService(factory as any);

      await expect(service.synthesize('hello', 'unknown')).rejects.toThrow(
        'Provider "unknown" not registered',
      );
    });
  });

  describe('synthesizeStream', () => {
    it('delegates to provider.synthesizeStream and returns the stream result', async () => {
      async function* gen(): AsyncGenerator<Uint8Array> {
        yield Uint8Array.from([1, 2, 3]);
      }
      const expected = { audioStream: gen(), contentType: 'audio/mpeg' };
      const synthesizeStream = jest.fn().mockResolvedValue(expected);
      const provider = makeProvider({ synthesizeStream });
      const factory = makeFactory(provider);
      const service = new TtsService(factory as any);

      const result = await service.synthesizeStream('hello', 'elevenlabs');

      expect(factory.getProvider).toHaveBeenCalledWith('elevenlabs');
      expect(synthesizeStream).toHaveBeenCalledWith('hello', undefined);
      expect(result).toEqual(expected);
    });

    it('throws when provider does not support streaming (synthesizeStream absent)', async () => {
      // Provider with NO synthesizeStream property
      const providerWithoutStream = {
        name: 'melotts',
        synthesize: jest.fn(),
        // synthesizeStream is intentionally absent
      };
      const factory = {
        getProvider: jest.fn().mockReturnValue(providerWithoutStream),
        listProviders: jest.fn(),
        getVoices: jest.fn(),
        getModels: jest.fn(),
      };
      const service = new TtsService(factory as any);

      await expect(
        service.synthesizeStream('hello', 'melotts'),
      ).rejects.toThrow('does not support streaming');
    });

    it('includes provider name in error message when streaming not supported', async () => {
      const providerWithoutStream = {
        name: 'my-provider',
        synthesize: jest.fn(),
      };
      const factory = {
        getProvider: jest.fn().mockReturnValue(providerWithoutStream),
        listProviders: jest.fn(),
        getVoices: jest.fn(),
        getModels: jest.fn(),
      };
      const service = new TtsService(factory as any);

      await expect(
        service.synthesizeStream('hello', 'my-provider'),
      ).rejects.toThrow('my-provider');
    });

    it('passes options to provider.synthesizeStream', async () => {
      async function* gen() {
        yield Uint8Array.from([1]);
      }
      const synthesizeStream = jest
        .fn()
        .mockResolvedValue({ audioStream: gen(), contentType: 'audio/mpeg' });
      const provider = makeProvider({ synthesizeStream });
      const factory = makeFactory(provider);
      const service = new TtsService(factory as any);
      const options = { voice: 'shimmer' };

      await service.synthesizeStream('test', 'openai', options);

      expect(synthesizeStream).toHaveBeenCalledWith('test', options);
    });

    it('propagates errors from provider.synthesizeStream', async () => {
      const synthesizeStream = jest
        .fn()
        .mockRejectedValue(new Error('stream failed'));
      const provider = makeProvider({ synthesizeStream });
      const factory = makeFactory(provider);
      const service = new TtsService(factory as any);

      await expect(service.synthesizeStream('hello', 'openai')).rejects.toThrow(
        'stream failed',
      );
    });
  });

  describe('listProviders', () => {
    it('returns provider list from factory', () => {
      const factory = makeFactory(makeProvider());
      const service = new TtsService(factory as any);

      const result = service.listProviders();

      expect(factory.listProviders).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('elevenlabs');
      expect(result[1].name).toBe('openai');
    });

    it('delegates entirely to factory.listProviders', () => {
      const factory = makeFactory(makeProvider());
      factory.listProviders.mockReturnValue([]);
      const service = new TtsService(factory as any);

      const result = service.listProviders();
      expect(result).toEqual([]);
    });
  });

  describe('getVoices', () => {
    it('returns voices from factory for given provider', () => {
      const factory = makeFactory(
        makeProvider({ voices: ['voice-a', 'voice-b'] }),
      );
      factory.getVoices.mockReturnValue(['voice-a', 'voice-b']);
      const service = new TtsService(factory as any);

      const result = service.getVoices('openai');

      expect(factory.getVoices).toHaveBeenCalledWith('openai');
      expect(result).toEqual(['voice-a', 'voice-b']);
    });

    it('returns empty array when provider has no voices', () => {
      const factory = makeFactory(makeProvider({ voices: [] }));
      factory.getVoices.mockReturnValue([]);
      const service = new TtsService(factory as any);

      const result = service.getVoices('melotts');
      expect(result).toEqual([]);
    });

    it('propagates errors when provider is not found', () => {
      const factory = makeFactory(makeProvider());
      factory.getVoices.mockImplementation(() => {
        throw new Error('TTS provider "unknown" not registered');
      });
      const service = new TtsService(factory as any);

      expect(() => service.getVoices('unknown')).toThrow(
        'TTS provider "unknown" not registered',
      );
    });
  });

  describe('getModels', () => {
    it('returns models from factory for given provider', () => {
      const factory = makeFactory(
        makeProvider({ models: ['tts-1', 'tts-1-hd'] }),
      );
      factory.getModels.mockReturnValue(['tts-1', 'tts-1-hd']);
      const service = new TtsService(factory as any);

      const result = service.getModels('openai');

      expect(factory.getModels).toHaveBeenCalledWith('openai');
      expect(result).toEqual(['tts-1', 'tts-1-hd']);
    });

    it('returns empty array when provider has no models', () => {
      const factory = makeFactory(makeProvider({ models: [] }));
      factory.getModels.mockReturnValue([]);
      const service = new TtsService(factory as any);

      const result = service.getModels('elevenlabs');
      expect(result).toEqual([]);
    });

    it('propagates errors when provider is not found', () => {
      const factory = makeFactory(makeProvider());
      factory.getModels.mockImplementation(() => {
        throw new Error('TTS provider "no-such" not registered');
      });
      const service = new TtsService(factory as any);

      expect(() => service.getModels('no-such')).toThrow(
        'TTS provider "no-such" not registered',
      );
    });
  });
});
