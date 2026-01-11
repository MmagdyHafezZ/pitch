import { ElevenLabsProvider } from '../../providers/tts/elevenlabs.provider';
import {
  TTSProviderAuthError,
  TTSProviderRequestError,
} from '../../providers/tts/tts-provider.interface';

const originalFetch = global.fetch;

describe('ElevenLabsProvider', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws when API key is missing', async () => {
    const configService = { get: jest.fn(() => '') } as any;
    const provider = new ElevenLabsProvider(configService);

    await expect(provider.synthesize({ text: 'hi' })).rejects.toThrow(
      TTSProviderAuthError,
    );
  });

  it('throws when voice is missing', async () => {
    const configService = {
      get: jest.fn((key: string) =>
        key === 'ELEVENLABS_API_KEY' ? 'key' : '',
      ),
    } as any;
    const provider = new ElevenLabsProvider(configService);

    await expect(provider.synthesize({ text: 'hi' })).rejects.toThrow(
      TTSProviderRequestError,
    );
  });

  it('returns audio buffer when request succeeds', async () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'ELEVENLABS_API_KEY') return 'key';
        if (key === 'ELEVENLABS_VOICE_ID') return 'voice-1';
        return undefined;
      }),
    } as any;

    const provider = new ElevenLabsProvider(configService);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
      headers: { get: jest.fn().mockReturnValue('req-1') },
    } as any);

    const response = await provider.synthesize({ text: 'hello' });

    expect(response.audioBuffer.length).toBe(3);
    expect(response.providerMeta?.requestId).toBe('req-1');
  });

  it('maps wav output formats', async () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'ELEVENLABS_API_KEY') return 'key';
        if (key === 'ELEVENLABS_VOICE_ID') return 'voice-1';
        return undefined;
      }),
    } as any;

    const provider = new ElevenLabsProvider(configService);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Uint8Array.from([9, 9]).buffer,
      headers: { get: jest.fn().mockReturnValue('req-2') },
    } as any);

    const response = await provider.synthesize({
      text: 'hello',
      format: 'wav',
    });

    expect(response.format).toBe('pcm_16000');
  });

  it('throws when API response fails', async () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'ELEVENLABS_API_KEY') return 'key';
        if (key === 'ELEVENLABS_VOICE_ID') return 'voice-1';
        return undefined;
      }),
    } as any;

    const provider = new ElevenLabsProvider(configService);

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      text: async () => 'bad request',
      headers: { get: jest.fn() },
      status: 400,
    } as any);

    await expect(provider.synthesize({ text: 'hello' })).rejects.toThrow(
      TTSProviderRequestError,
    );
  });
});
