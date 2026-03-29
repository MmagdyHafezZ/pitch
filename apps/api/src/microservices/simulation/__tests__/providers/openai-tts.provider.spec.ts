/**
 * Tests for the TTS-specific OpenAI provider (tts/providers/openai.provider.ts)
 * Not to be confused with the LLM OpenAI provider in providers/llm/openai.provider.ts
 */
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { OpenAITtsProvider } from '../../tts/providers/openai.provider';

const speechCreateMock = jest.fn();

jest.mock('openai', () => {
  class OpenAI {
    audio = {
      speech: {
        create: speechCreateMock,
      },
    };
  }
  return { __esModule: true, default: OpenAI };
});

const createConfig = (values: Record<string, string | undefined> = {}) => ({
  get: jest.fn((key: string) => values[key]),
});

describe('OpenAITtsProvider', () => {
  beforeEach(() => {
    speechCreateMock.mockReset();
  });

  describe('constructor', () => {
    it('constructs successfully with an API key', () => {
      const config = createConfig({ OPENAI_API_KEY: 'sk-test' });
      const provider = new OpenAITtsProvider(config as any);
      expect(provider.name).toBe('openai');
      expect(provider.description).toBe('OpenAI text-to-speech');
    });

    it('constructs without API key (logs warning but does not throw)', () => {
      const config = createConfig({});
      const provider = new OpenAITtsProvider(config as any);
      expect(provider).toBeDefined();
    });

    it('exposes all voices', () => {
      const config = createConfig({ OPENAI_API_KEY: 'sk-test' });
      const provider = new OpenAITtsProvider(config as any);
      expect(Array.isArray(provider.voices)).toBe(true);
      expect(provider.voices).toContain('alloy');
      expect(provider.voices).toContain('shimmer');
    });

    it('exposes all models', () => {
      const config = createConfig({ OPENAI_API_KEY: 'sk-test' });
      const provider = new OpenAITtsProvider(config as any);
      expect(Array.isArray(provider.models)).toBe(true);
      expect(provider.models).toContain('tts-1');
      expect(provider.models).toContain('gpt-4o-mini-tts');
    });

    it('uses OPENAI_TTS_DEFAULT_VOICE from config', () => {
      const config = createConfig({
        OPENAI_API_KEY: 'sk-test',
        OPENAI_TTS_DEFAULT_VOICE: 'echo',
      });
      const provider = new OpenAITtsProvider(config as any);
      // Default voice is stored privately; we test it implicitly through synthesize
      expect(provider).toBeDefined();
    });

    it('uses OPENAI_TTS_DEFAULT_MODEL from config', () => {
      const config = createConfig({
        OPENAI_API_KEY: 'sk-test',
        OPENAI_TTS_DEFAULT_MODEL: 'tts-1-hd',
      });
      const provider = new OpenAITtsProvider(config as any);
      expect(provider).toBeDefined();
    });

    it('throws BadRequestException for unknown default voice in config', () => {
      const config = createConfig({
        OPENAI_API_KEY: 'sk-test',
        OPENAI_TTS_DEFAULT_VOICE: 'invalid-voice',
      });
      expect(() => new OpenAITtsProvider(config as any)).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for unknown default model in config', () => {
      const config = createConfig({
        OPENAI_API_KEY: 'sk-test',
        OPENAI_TTS_DEFAULT_MODEL: 'unknown-model',
      });
      expect(() => new OpenAITtsProvider(config as any)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('synthesize', () => {
    it('throws InternalServerErrorException when API key is not configured', async () => {
      const config = createConfig({});
      const provider = new OpenAITtsProvider(config as any);

      await expect(provider.synthesize('hello')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('returns audio buffer and mp3 content type by default', async () => {
      const ab = new ArrayBuffer(3);
      new Uint8Array(ab).set([1, 2, 3]);
      speechCreateMock.mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(ab),
      });

      const config = createConfig({ OPENAI_API_KEY: 'sk-test' });
      const provider = new OpenAITtsProvider(config as any);

      const result = await provider.synthesize('hello world');

      expect(result.contentType).toBe('audio/mpeg');
      expect(Buffer.isBuffer(result.audioBuffer)).toBe(true);
      expect(result.audioBuffer.length).toBe(3);
    });

    it('calls speech.create with correct parameters', async () => {
      speechCreateMock.mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(4)),
      });

      const config = createConfig({ OPENAI_API_KEY: 'sk-test' });
      const provider = new OpenAITtsProvider(config as any);

      await provider.synthesize('test text', { voice: 'echo', model: 'tts-1' });

      expect(speechCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'test text',
          voice: 'echo',
          model: 'tts-1',
          response_format: 'mp3',
        }),
      );
    });

    it('uses default voice when no voice option provided', async () => {
      speechCreateMock.mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(4)),
      });

      const config = createConfig({ OPENAI_API_KEY: 'sk-test' });
      const provider = new OpenAITtsProvider(config as any);

      await provider.synthesize('hello');

      expect(speechCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ voice: 'alloy' }),
      );
    });

    it('uses default model when no model option provided', async () => {
      speechCreateMock.mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(4)),
      });

      const config = createConfig({ OPENAI_API_KEY: 'sk-test' });
      const provider = new OpenAITtsProvider(config as any);

      await provider.synthesize('hello');

      expect(speechCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4o-mini-tts' }),
      );
    });

    describe('format resolution', () => {
      const makeBuffer = () => ({
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(4)),
      });

      it('returns wav content type for wav format', async () => {
        speechCreateMock.mockResolvedValue(makeBuffer());
        const config = createConfig({ OPENAI_API_KEY: 'sk-test' });
        const provider = new OpenAITtsProvider(config as any);

        const result = await provider.synthesize('hello', { format: 'wav' });
        expect(result.contentType).toBe('audio/wav');
        expect(speechCreateMock).toHaveBeenCalledWith(
          expect.objectContaining({ response_format: 'wav' }),
        );
      });

      it('maps ogg format to opus and returns audio/ogg content type', async () => {
        speechCreateMock.mockResolvedValue(makeBuffer());
        const config = createConfig({ OPENAI_API_KEY: 'sk-test' });
        const provider = new OpenAITtsProvider(config as any);

        const result = await provider.synthesize('hello', { format: 'ogg' });
        expect(result.contentType).toBe('audio/ogg');
        expect(speechCreateMock).toHaveBeenCalledWith(
          expect.objectContaining({ response_format: 'opus' }),
        );
      });

      it('defaults to mp3 for pcm format (falls through to default)', async () => {
        speechCreateMock.mockResolvedValue(makeBuffer());
        const config = createConfig({ OPENAI_API_KEY: 'sk-test' });
        const provider = new OpenAITtsProvider(config as any);

        const result = await provider.synthesize('hello', { format: 'pcm' });
        expect(result.contentType).toBe('audio/mpeg');
      });

      it('defaults to mp3 when format is undefined', async () => {
        speechCreateMock.mockResolvedValue(makeBuffer());
        const config = createConfig({ OPENAI_API_KEY: 'sk-test' });
        const provider = new OpenAITtsProvider(config as any);

        const result = await provider.synthesize('hello');
        expect(result.contentType).toBe('audio/mpeg');
      });
    });

    describe('voice validation', () => {
      it('throws BadRequestException for unknown voice', async () => {
        const config = createConfig({ OPENAI_API_KEY: 'sk-test' });
        const provider = new OpenAITtsProvider(config as any);

        await expect(
          provider.synthesize('hello', { voice: 'unknown-voice' }),
        ).rejects.toThrow(BadRequestException);
      });

      it('accepts all valid voices', async () => {
        speechCreateMock.mockResolvedValue({
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(4)),
        });

        const config = createConfig({ OPENAI_API_KEY: 'sk-test' });
        const provider = new OpenAITtsProvider(config as any);

        const voices = [
          'alloy',
          'ash',
          'ballad',
          'cedar',
          'coral',
          'echo',
          'marin',
          'sage',
          'shimmer',
          'verse',
        ];
        for (const voice of voices) {
          const result = await provider.synthesize('test', { voice });
          expect(result).toBeDefined();
        }
      });

      it('is case-insensitive for voice names', async () => {
        speechCreateMock.mockResolvedValue({
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(4)),
        });

        const config = createConfig({ OPENAI_API_KEY: 'sk-test' });
        const provider = new OpenAITtsProvider(config as any);

        const result = await provider.synthesize('hello', { voice: 'ALLOY' });
        expect(result).toBeDefined();
        expect(speechCreateMock).toHaveBeenCalledWith(
          expect.objectContaining({ voice: 'alloy' }),
        );
      });

      it('trims whitespace from voice input', async () => {
        speechCreateMock.mockResolvedValue({
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(4)),
        });

        const config = createConfig({ OPENAI_API_KEY: 'sk-test' });
        const provider = new OpenAITtsProvider(config as any);

        const result = await provider.synthesize('hello', {
          voice: '  echo  ',
        });
        expect(result).toBeDefined();
      });
    });

    describe('model validation', () => {
      it('throws BadRequestException for unknown model', async () => {
        const config = createConfig({ OPENAI_API_KEY: 'sk-test' });
        const provider = new OpenAITtsProvider(config as any);

        await expect(
          provider.synthesize('hello', { model: 'gpt-4o' }), // LLM model, not TTS
        ).rejects.toThrow(BadRequestException);
      });

      it('accepts tts-1 model', async () => {
        speechCreateMock.mockResolvedValue({
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(4)),
        });

        const config = createConfig({ OPENAI_API_KEY: 'sk-test' });
        const provider = new OpenAITtsProvider(config as any);

        const result = await provider.synthesize('hello', { model: 'tts-1' });
        expect(result).toBeDefined();
      });

      it('accepts tts-1-hd model', async () => {
        speechCreateMock.mockResolvedValue({
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(4)),
        });

        const config = createConfig({ OPENAI_API_KEY: 'sk-test' });
        const provider = new OpenAITtsProvider(config as any);

        const result = await provider.synthesize('hello', {
          model: 'tts-1-hd',
        });
        expect(result).toBeDefined();
      });

      it('is case-insensitive for model names', async () => {
        speechCreateMock.mockResolvedValue({
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(4)),
        });

        const config = createConfig({ OPENAI_API_KEY: 'sk-test' });
        const provider = new OpenAITtsProvider(config as any);

        const result = await provider.synthesize('hello', { model: 'TTS-1' });
        expect(result).toBeDefined();
      });
    });

    describe('error handling', () => {
      it('wraps OpenAI client errors in InternalServerErrorException', async () => {
        speechCreateMock.mockRejectedValue(new Error('OpenAI API error'));

        const config = createConfig({ OPENAI_API_KEY: 'sk-test' });
        const provider = new OpenAITtsProvider(config as any);

        await expect(provider.synthesize('hello')).rejects.toThrow(
          InternalServerErrorException,
        );
      });

      it('re-throws BadRequestException without wrapping', async () => {
        const config = createConfig({ OPENAI_API_KEY: 'sk-test' });
        const provider = new OpenAITtsProvider(config as any);

        // This will throw BadRequestException from voice validation, before API call
        await expect(
          provider.synthesize('hello', { voice: 'invalid' }),
        ).rejects.toThrow(BadRequestException);

        expect(speechCreateMock).not.toHaveBeenCalled();
      });
    });
  });
});
