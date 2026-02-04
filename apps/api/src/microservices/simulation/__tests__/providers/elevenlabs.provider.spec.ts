import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ElevenLabsTtsProvider } from '../../tts/providers/elevenlabs.provider';

const convertMock = jest.fn();
const streamMock = jest.fn();

jest.mock('@elevenlabs/elevenlabs-js', () => ({
  ElevenLabsClient: jest.fn().mockImplementation(() => ({
    textToSpeech: {
      convert: convertMock,
      stream: streamMock,
    },
  })),
}));

// helper to create a Web ReadableStream of Uint8Array chunks
const createStream = (chunks: number[][]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(Uint8Array.from(chunk));
      }
      controller.close();
    },
  });

const originalFetch = global.fetch;

const createConfig = (values: Record<string, string | undefined>) => ({
  getOrThrow: jest.fn((key: string) => {
    const value = values[key];
    if (!value) {
      throw new Error(`${key} is not configured`);
    }
    return value;
  }),
  get: jest.fn((key: string) => values[key]),
});

describe('ElevenLabsTtsProvider', () => {
  beforeEach(() => {
    convertMock.mockReset();
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('throws when API key is missing', () => {
    const configService = createConfig({});

    expect(() => new ElevenLabsTtsProvider(configService as any)).toThrow(
      'ELEVENLABS_API_KEY',
    );
  });

  it('throws when voice is missing', async () => {
    const configService = createConfig({
      ELEVENLABS_API_KEY: 'key',
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ voices: [] }),
    });

    const provider = new ElevenLabsTtsProvider(configService as any);

    await expect(provider.synthesize('hi')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('returns audio buffer when request succeeds', async () => {
    const configService = createConfig({
      ELEVENLABS_API_KEY: 'key',
      ELEVENLABS_DEFAULT_VOICE: 'Test Voice',
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          voices: [{ voice_id: 'voice-1', name: 'Test Voice' }],
        }),
    });

    convertMock.mockResolvedValue(createStream([[1, 2, 3]]));

    const provider = new ElevenLabsTtsProvider(configService as any);
    const response = await provider.synthesize('hello');

    expect(response.audioBuffer.length).toBe(3);
    expect(response.contentType).toBe('audio/mpeg');
  });

  it('returns streaming chunks when using synthesizeStream', async () => {
    const configService = createConfig({
      ELEVENLABS_API_KEY: 'key',
      ELEVENLABS_DEFAULT_VOICE: 'Test Voice',
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          voices: [{ voice_id: 'voice-1', name: 'Test Voice' }],
        }),
    });

    // stream returns a ReadableStream of Uint8Array
    streamMock.mockResolvedValue(createStream([[1], [2, 3]]));

    const provider = new ElevenLabsTtsProvider(configService as any);
    const res = await provider.synthesizeStream('hello');

    const chunks: number[] = [];
    for await (const chunk of res.audioStream) {
      chunks.push(...Array.from(chunk));
    }

    expect(chunks).toEqual([1, 2, 3]);
    expect(res.contentType).toBe('audio/mpeg');
  });

  it('wraps failures when voices fetch fails', async () => {
    const configService = createConfig({
      ELEVENLABS_API_KEY: 'key',
      ELEVENLABS_DEFAULT_VOICE: 'Test Voice',
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('boom'),
    });

    const provider = new ElevenLabsTtsProvider(configService as any);

    await expect(provider.synthesize('hello')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
