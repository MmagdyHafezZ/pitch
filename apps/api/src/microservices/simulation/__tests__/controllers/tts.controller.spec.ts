import { TtsMicroserviceController } from '../../tts/tts.controller';
import { TtsService } from '../../tts/tts.service';
import { firstValueFrom, toArray } from 'rxjs';

jest.mock('@pitch/shared-backend/helpers/exceptions', () => ({
  toRpcException: jest.fn((err) => err),
}));

function makeTtsService(
  overrides: Partial<Record<keyof TtsService, jest.Mock>> = {},
) {
  return {
    synthesize: overrides.synthesize ?? jest.fn(),
    synthesizeStream: overrides.synthesizeStream ?? jest.fn(),
    listProviders: overrides.listProviders ?? jest.fn(),
    getVoices: overrides.getVoices ?? jest.fn(),
    getModels: overrides.getModels ?? jest.fn(),
  } as unknown as TtsService;
}

describe('TtsMicroserviceController', () => {
  describe('speak', () => {
    it('returns base64-encoded audio with content type', async () => {
      const audioBuffer = Buffer.from('audio-data');
      const synthesize = jest.fn().mockResolvedValue({
        audioBuffer,
        contentType: 'audio/mpeg',
      });
      const service = makeTtsService({ synthesize });
      const controller = new TtsMicroserviceController(service);

      const result = await controller.speak({
        text: 'Hello',
        provider: 'openai',
        options: { voice: 'alloy' },
      });

      expect(synthesize).toHaveBeenCalledWith('Hello', 'openai', {
        voice: 'alloy',
      });
      expect(result).toEqual({
        audioBase64: audioBuffer.toString('base64'),
        contentType: 'audio/mpeg',
      });
    });

    it('passes options through to service', async () => {
      const synthesize = jest.fn().mockResolvedValue({
        audioBuffer: Buffer.from([]),
        contentType: 'audio/wav',
      });
      const service = makeTtsService({ synthesize });
      const controller = new TtsMicroserviceController(service);

      await controller.speak({
        text: 'Test',
        provider: 'elevenlabs',
        options: { voice: 'shimmer', model: 'tts-1', format: 'wav' },
      });

      expect(synthesize).toHaveBeenCalledWith('Test', 'elevenlabs', {
        voice: 'shimmer',
        model: 'tts-1',
        format: 'wav',
      });
    });

    it('throws when synthesis fails', async () => {
      const synthesize = jest.fn().mockRejectedValue(new Error('TTS error'));
      const service = makeTtsService({ synthesize });
      const controller = new TtsMicroserviceController(service);

      await expect(
        controller.speak({ text: 'Hi', provider: 'openai' }),
      ).rejects.toThrow('TTS error');
    });

    it('handles missing options gracefully', async () => {
      const synthesize = jest.fn().mockResolvedValue({
        audioBuffer: Buffer.from('data'),
        contentType: 'audio/mpeg',
      });
      const service = makeTtsService({ synthesize });
      const controller = new TtsMicroserviceController(service);

      const result = await controller.speak({
        text: 'Hello',
        provider: 'openai',
      });

      expect(synthesize).toHaveBeenCalledWith('Hello', 'openai', undefined);
      expect(result.audioBase64).toBe(Buffer.from('data').toString('base64'));
    });
  });

  describe('stream', () => {
    it('returns an observable that emits base64 chunks and completes', async () => {
      async function* gen(): AsyncGenerator<Uint8Array> {
        yield Uint8Array.from([1, 2, 3]);
        yield Uint8Array.from([4, 5, 6]);
      }

      const synthesizeStream = jest.fn().mockResolvedValue({
        audioStream: gen(),
        contentType: 'audio/mpeg',
      });
      const service = makeTtsService({ synthesizeStream });
      const controller = new TtsMicroserviceController(service);

      const obs = controller.stream({ text: 'Hello', provider: 'openai' });
      const results = await firstValueFrom(obs.pipe(toArray()));

      expect(results).toHaveLength(2);
      expect(results[0].audioBase64).toBe(
        Buffer.from([1, 2, 3]).toString('base64'),
      );
      expect(results[1].audioBase64).toBe(
        Buffer.from([4, 5, 6]).toString('base64'),
      );
      expect(results[0].contentType).toBe('audio/mpeg');
    });

    it('errors the observable when synthesis stream fails', async () => {
      const synthesizeStream = jest
        .fn()
        .mockRejectedValue(new Error('stream err'));
      const service = makeTtsService({ synthesizeStream });
      const controller = new TtsMicroserviceController(service);

      const obs = controller.stream({ text: 'Hi', provider: 'openai' });

      await expect(firstValueFrom(obs)).rejects.toThrow('stream err');
    });
  });

  describe('listProviders', () => {
    it('delegates to service and returns provider list', () => {
      const providers = [
        { name: 'elevenlabs', description: 'ElevenLabs' },
        { name: 'openai', description: 'OpenAI TTS' },
      ];
      const listProviders = jest.fn().mockReturnValue(providers);
      const service = makeTtsService({ listProviders });
      const controller = new TtsMicroserviceController(service);

      const result = controller.listProviders();

      expect(listProviders).toHaveBeenCalled();
      expect(result).toEqual(providers);
    });

    it('throws when service throws', () => {
      const listProviders = jest.fn().mockImplementation(() => {
        throw new Error('list failed');
      });
      const service = makeTtsService({ listProviders });
      const controller = new TtsMicroserviceController(service);

      expect(() => controller.listProviders()).toThrow('list failed');
    });
  });

  describe('getVoices', () => {
    it('returns voices and models for the given provider', () => {
      const getVoices = jest.fn().mockReturnValue(['alloy', 'echo']);
      const getModels = jest.fn().mockReturnValue(['tts-1', 'tts-1-hd']);
      const service = makeTtsService({ getVoices, getModels });
      const controller = new TtsMicroserviceController(service);

      const result = controller.getVoices({ provider: 'openai' });

      expect(result).toEqual({
        provider: 'openai',
        voices: ['alloy', 'echo'],
        models: ['tts-1', 'tts-1-hd'],
      });
    });

    it('throws when service throws', () => {
      const getVoices = jest.fn().mockImplementation(() => {
        throw new Error('not found');
      });
      const service = makeTtsService({ getVoices });
      const controller = new TtsMicroserviceController(service);

      expect(() => controller.getVoices({ provider: 'unknown' })).toThrow(
        'not found',
      );
    });
  });
});
