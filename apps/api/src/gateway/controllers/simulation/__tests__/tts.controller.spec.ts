import { of, throwError, lastValueFrom } from 'rxjs';
import { HttpException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import type { Response } from 'express';
import { TtsGatewayController } from '../tts.controller';
import { TTS_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';

// ── helpers ──────────────────────────────────────────────────────────────────

const makeClient = (): jest.Mocked<ClientProxy> =>
  ({ send: jest.fn() }) as unknown as jest.Mocked<ClientProxy>;

const makeRes = (): jest.Mocked<Response> =>
  ({
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    send: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
  }) as unknown as jest.Mocked<Response>;

const audioPayload = {
  audioBase64: Buffer.from('fake-audio').toString('base64'),
  contentType: 'audio/mpeg',
};

const speakDto = {
  text: 'Hello world',
  provider: 'openai',
  voice: 'nova',
  model: 'tts-1',
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe('TtsGatewayController', () => {
  // ── speak() ───────────────────────────────────────────────────────────────

  describe('speak()', () => {
    it('sends SPEAK pattern with text, provider and options', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of(audioPayload));
      const ctrl = new TtsGatewayController(client);
      const res = makeRes();

      await ctrl.speak(speakDto, res as unknown as Response);

      expect(client.send).toHaveBeenCalledWith(TTS_SERVICE_PATTERNS.SPEAK, {
        text: speakDto.text,
        provider: speakDto.provider,
        options: { voice: speakDto.voice, model: speakDto.model },
      });
    });

    it('sets Content-Type and Content-Length headers and sends the audio buffer', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of(audioPayload));
      const ctrl = new TtsGatewayController(client);
      const res = makeRes();

      await ctrl.speak(speakDto, res as unknown as Response);

      const expectedBuffer = Buffer.from(audioPayload.audioBase64, 'base64');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'audio/mpeg');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Length',
        expectedBuffer.length,
      );
      expect(res.setHeader).toHaveBeenCalledWith('Accept-Ranges', 'bytes');
      expect(res.send).toHaveBeenCalledWith(expectedBuffer);
    });

    it('throws HttpException when the microservice returns an error', async () => {
      const client = makeClient();
      client.send.mockReturnValue(
        throwError(() => ({ message: 'TTS failed', status: 500 })),
      );
      const ctrl = new TtsGatewayController(client);
      const res = makeRes();

      await expect(
        ctrl.speak(speakDto, res as unknown as Response),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── stream() ──────────────────────────────────────────────────────────────

  describe('stream()', () => {
    it('sends STREAM pattern with correct payload', () => {
      const client = makeClient();
      client.send.mockReturnValue(of(audioPayload));
      const ctrl = new TtsGatewayController(client);
      const res = makeRes();

      ctrl.stream(speakDto, res as unknown as Response);

      expect(client.send).toHaveBeenCalledWith(TTS_SERVICE_PATTERNS.STREAM, {
        text: speakDto.text,
        provider: speakDto.provider,
        options: { voice: speakDto.voice, model: speakDto.model },
      });
    });

    it('flushes headers and writes audio chunks', (done) => {
      const client = makeClient();
      client.send.mockReturnValue(of(audioPayload));
      const ctrl = new TtsGatewayController(client);
      const res = makeRes();
      (res.on as jest.Mock).mockImplementation(() => res);

      ctrl.stream(speakDto, res as unknown as Response);

      setImmediate(() => {
        expect(res.setHeader).toHaveBeenCalledWith(
          'Content-Type',
          'audio/mpeg',
        );
        expect(res.setHeader).toHaveBeenCalledWith(
          'Transfer-Encoding',
          'chunked',
        );
        expect(res.flushHeaders).toHaveBeenCalled();
        expect(res.write).toHaveBeenCalledWith(
          Buffer.from(audioPayload.audioBase64, 'base64'),
        );
        expect(res.end).toHaveBeenCalled();
        done();
      });
    });

    it('ends the response on error', (done) => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('stream error')));
      const ctrl = new TtsGatewayController(client);
      const res = makeRes();
      (res.on as jest.Mock).mockImplementation(() => res);

      ctrl.stream(speakDto, res as unknown as Response);

      setImmediate(() => {
        expect(res.end).toHaveBeenCalled();
        done();
      });
    });

    it('registers a close listener to unsubscribe from the stream', () => {
      const client = makeClient();
      // Return an observable that never completes so we can test close handling
      client.send.mockReturnValue(of(audioPayload));
      const ctrl = new TtsGatewayController(client);
      const res = makeRes();
      (res.on as jest.Mock).mockImplementation(() => res);

      ctrl.stream(speakDto, res as unknown as Response);

      expect(res.on).toHaveBeenCalledWith('close', expect.any(Function));
    });
  });

  // ── listProviders() ───────────────────────────────────────────────────────

  describe('listProviders()', () => {
    it('sends LIST_PROVIDERS and returns the result', async () => {
      const client = makeClient();
      const providers = [{ name: 'openai', voices: ['nova', 'alloy'] }];
      client.send.mockReturnValue(of(providers));
      const ctrl = new TtsGatewayController(client);

      const result = await lastValueFrom(ctrl.listProviders());

      expect(result).toEqual(providers);
      expect(client.send).toHaveBeenCalledWith(
        TTS_SERVICE_PATTERNS.LIST_PROVIDERS,
        {},
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new TtsGatewayController(client);

      await expect(lastValueFrom(ctrl.listProviders())).rejects.toThrow(
        HttpException,
      );
    });
  });

  // ── getVoices() ───────────────────────────────────────────────────────────

  describe('getVoices()', () => {
    it('sends GET_VOICES with provider and returns voices', async () => {
      const client = makeClient();
      const voices = { voices: ['nova', 'alloy'] };
      client.send.mockReturnValue(of(voices));
      const ctrl = new TtsGatewayController(client);

      const result = await lastValueFrom(ctrl.getVoices('openai'));

      expect(result).toEqual(voices);
      expect(client.send).toHaveBeenCalledWith(
        TTS_SERVICE_PATTERNS.GET_VOICES,
        {
          provider: 'openai',
        },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new TtsGatewayController(client);

      await expect(lastValueFrom(ctrl.getVoices('unknown'))).rejects.toThrow(
        HttpException,
      );
    });
  });
});
