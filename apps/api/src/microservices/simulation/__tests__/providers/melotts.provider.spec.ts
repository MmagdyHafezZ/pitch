import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { MeloTtsProvider } from '../../tts/providers/melotts.provider';

const originalFetch = global.fetch;

const createConfig = (values: Record<string, string | undefined>) => ({
  get: jest.fn((key: string) => values[key]),
  getOrThrow: jest.fn((key: string) => {
    const val = values[key];
    if (val === undefined) {
      throw new Error(`${key} is not configured`);
    }
    return val;
  }),
});

const defaultConfig = createConfig({
  CLOUDFLARE_API_TOKEN: 'cf-token',
  CLOUDFLARE_ACCOUNT_ID: 'cf-account-id',
});

describe('MeloTtsProvider', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    jest.clearAllMocks();
    defaultConfig.getOrThrow.mockImplementation((key: string) => {
      const values: Record<string, string> = {
        CLOUDFLARE_API_TOKEN: 'cf-token',
        CLOUDFLARE_ACCOUNT_ID: 'cf-account-id',
      };
      if (!(key in values)) throw new Error(`${key} is not configured`);
      return values[key];
    });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('constructor', () => {
    it('constructs successfully when credentials are provided', () => {
      const provider = new MeloTtsProvider(defaultConfig as any);
      expect(provider.name).toBe('melotts');
    });

    it('throws when CLOUDFLARE_API_TOKEN is missing', () => {
      const config = createConfig({ CLOUDFLARE_ACCOUNT_ID: 'cf-account-id' });
      expect(() => new MeloTtsProvider(config as any)).toThrow(
        'CLOUDFLARE_API_TOKEN',
      );
    });

    it('throws when CLOUDFLARE_ACCOUNT_ID is missing', () => {
      const config = createConfig({ CLOUDFLARE_API_TOKEN: 'cf-token' });
      expect(() => new MeloTtsProvider(config as any)).toThrow(
        'CLOUDFLARE_ACCOUNT_ID',
      );
    });

    it('exposes expected properties', () => {
      const provider = new MeloTtsProvider(defaultConfig as any);
      expect(provider.description).toBe(
        'Cloudflare MeloTTS neural text-to-speech',
      );
      expect(Array.isArray(provider.voices)).toBe(true);
      expect(provider.voices.length).toBeGreaterThan(0);
    });
  });

  describe('synthesize — happy path', () => {
    it('returns audio buffer and correct content type', async () => {
      const audioBase64 = Buffer.from([1, 2, 3]).toString('base64');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          result: { audio: audioBase64 },
        }),
      });

      const provider = new MeloTtsProvider(defaultConfig as any);
      const result = await provider.synthesize('hello world');

      expect(result.contentType).toBe('audio/mpeg');
      expect(Buffer.isBuffer(result.audioBuffer)).toBe(true);
      expect(result.audioBuffer.length).toBe(3);
    });

    it('sends correct Authorization header and body', async () => {
      const audioBase64 = Buffer.from([1]).toString('base64');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          result: { audio: audioBase64 },
        }),
      });

      const provider = new MeloTtsProvider(defaultConfig as any);
      await provider.synthesize('test text');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('melotts'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer cf-token',
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('"prompt":"test text"'),
        }),
      );
    });

    it('defaults to English language when no options provided', async () => {
      const audioBase64 = Buffer.from([1]).toString('base64');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          result: { audio: audioBase64 },
        }),
      });

      const provider = new MeloTtsProvider(defaultConfig as any);
      await provider.synthesize('hello');

      const callBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body as string,
      );
      expect(callBody.lang).toBe('en');
    });
  });

  describe('synthesize — language / voice resolution', () => {
    const successResponse = (lang: string) => ({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        result: { audio: Buffer.from([1]).toString('base64') },
      }),
    });

    it('extracts language from voice option', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(successResponse('es'));

      const provider = new MeloTtsProvider(defaultConfig as any);
      await provider.synthesize('hola', { voice: 'es - Spanish' });

      const callBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body as string,
      );
      expect(callBody.lang).toBe('es');
    });

    it('falls back to language option when voice lang is not supported', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(successResponse('fr'));

      const provider = new MeloTtsProvider(defaultConfig as any);
      await provider.synthesize('bonjour', {
        voice: 'zz - Unknown',
        language: 'fr',
      });

      const callBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body as string,
      );
      expect(callBody.lang).toBe('fr');
    });

    it('uses language option directly when no voice specified', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(successResponse('de'));

      const provider = new MeloTtsProvider(defaultConfig as any);
      await provider.synthesize('hallo', { language: 'de' });

      const callBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body as string,
      );
      expect(callBody.lang).toBe('de');
    });

    it('strips sub-tag from language (e.g. fr-CA → fr)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(successResponse('fr'));

      const provider = new MeloTtsProvider(defaultConfig as any);
      await provider.synthesize('bonjour', { language: 'fr-CA' });

      const callBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body as string,
      );
      expect(callBody.lang).toBe('fr');
    });

    it('supports all declared voice languages', async () => {
      const provider = new MeloTtsProvider(defaultConfig as any);
      const languages = ['en', 'es', 'fr', 'de', 'it', 'ja', 'zh', 'ko'];

      for (const lang of languages) {
        const audioBase64 = Buffer.from([1]).toString('base64');
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest
            .fn()
            .mockResolvedValue({
              success: true,
              result: { audio: audioBase64 },
            }),
        });

        const result = await provider.synthesize('text', { language: lang });
        expect(result.contentType).toBe('audio/mpeg');
      }
    });
  });

  describe('synthesize — error handling', () => {
    it('throws BadRequestException on 400 response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue('bad input'),
      });

      const provider = new MeloTtsProvider(defaultConfig as any);
      await expect(provider.synthesize('hello')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws InternalServerErrorException on 401 response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValue('unauthorized'),
      });

      const provider = new MeloTtsProvider(defaultConfig as any);
      await expect(provider.synthesize('hello')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('throws InternalServerErrorException on 403 response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        text: jest.fn().mockResolvedValue('forbidden'),
      });

      const provider = new MeloTtsProvider(defaultConfig as any);
      await expect(provider.synthesize('hello')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('throws InternalServerErrorException on other non-ok status', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('server error'),
      });

      const provider = new MeloTtsProvider(defaultConfig as any);
      await expect(provider.synthesize('hello')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('throws InternalServerErrorException when success is false', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: false,
          result: null,
        }),
      });

      const provider = new MeloTtsProvider(defaultConfig as any);
      await expect(provider.synthesize('hello')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('throws InternalServerErrorException when audio field is missing', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          result: {},
        }),
      });

      const provider = new MeloTtsProvider(defaultConfig as any);
      await expect(provider.synthesize('hello')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('wraps unexpected errors in InternalServerErrorException', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('unexpected'));

      const provider = new MeloTtsProvider(defaultConfig as any);
      await expect(provider.synthesize('hello')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('re-throws BadRequestException from inner error without wrapping', async () => {
      // When validateLanguage throws, it should propagate as BadRequestException
      const provider = new MeloTtsProvider(defaultConfig as any);
      await expect(
        provider.synthesize('hello', { language: 'xx' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for unsupported language', async () => {
      const provider = new MeloTtsProvider(defaultConfig as any);
      await expect(
        provider.synthesize('hello', { language: 'tlh' }), // Klingon
      ).rejects.toThrow(BadRequestException);
    });
  });
});
