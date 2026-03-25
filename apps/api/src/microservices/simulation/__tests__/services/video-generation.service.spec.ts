import { VideoGenerationService } from '../../services/video-generation.service';

describe('VideoGenerationService', () => {
  let service: VideoGenerationService;

  beforeEach(() => {
    service = new VideoGenerationService();
  });

  describe('resolveVideoConfig()', () => {
    it('should always return rendered mode', () => {
      const result = service.resolveVideoConfig({}, null);
      expect(result).toEqual({ mode: 'rendered' });
    });

    it('should return rendered mode regardless of session config', () => {
      const result = service.resolveVideoConfig(
        { avatarProvider: 'heygen', avatarId: 'abc' },
        { voice: { provider: 'elevenlabs' } },
      );
      expect(result).toEqual({ mode: 'rendered' });
    });
  });

  describe('queueAssistantVideo()', () => {
    it('should resolve immediately (no-op)', async () => {
      await expect(
        service.queueAssistantVideo({
          sessionId: 'session-1',
          requestId: 'req-1',
          text: 'Hello world',
          ttsProvider: 'elevenlabs',
          ttsVoice: 'TestVoice',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('getVideoAudioAsset()', () => {
    it('should return null', async () => {
      const result = await service.getVideoAudioAsset('job-1', 'token-1');
      expect(result).toBeNull();
    });
  });

  describe('getVideoStreamResponse()', () => {
    it('should return null', async () => {
      const result = await service.getVideoStreamResponse(
        'session-1',
        'token-1',
      );
      expect(result).toBeNull();
    });

    it('should return null with range header', async () => {
      const result = await service.getVideoStreamResponse(
        'session-1',
        'token-1',
        'bytes=0-1000',
      );
      expect(result).toBeNull();
    });
  });

  describe('handleHeyGenCallback()', () => {
    it('should resolve immediately (no-op)', async () => {
      await expect(
        service.handleHeyGenCallback({ event: 'avatar.video.completed' }),
      ).resolves.toBeUndefined();
    });

    it('should handle empty payload', async () => {
      await expect(service.handleHeyGenCallback({})).resolves.toBeUndefined();
    });

    it('should handle null payload', async () => {
      await expect(service.handleHeyGenCallback(null)).resolves.toBeUndefined();
    });
  });
});
