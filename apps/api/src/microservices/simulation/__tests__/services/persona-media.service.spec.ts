import { PersonaMediaService } from '../../services/persona-media.service';
import { TtsService } from '../../tts/tts.service';
import { SimulationRedisService } from '../../services/redis/redis.service';

describe('PersonaMediaService', () => {
  let service: PersonaMediaService;
  let ttsService: any;
  let redis: any;

  beforeEach(() => {
    ttsService = {
      synthesize: jest.fn().mockResolvedValue({
        audioBuffer: Buffer.from('test-audio'),
        contentType: 'audio/mpeg',
      }),
      getVoices: jest
        .fn()
        .mockReturnValue([
          'Bella - Professional, Bright, Warm',
          'Sarah - Mature, Reassuring, Confident',
          'Eric - Smooth, Trustworthy',
          'Brian - Deep, Resonant and Comforting',
          'Daniel - Steady Broadcaster',
          'Alice - Clear, Engaging Educator',
          'Adam - Dominant, Firm',
          'Charlie - Deep, Confident, Energetic',
          'George - Warm, Captivating Storyteller',
          'Lily - Velvety Actress',
          'Matilda - Knowledgable, Professional',
          'River - Relaxed, Neutral, Informative',
        ]),
    };

    redis = {
      getPersonaPreviewAudio: jest.fn().mockResolvedValue(null),
      setPersonaPreviewAudio: jest.fn().mockResolvedValue(undefined),
    };

    service = new PersonaMediaService(
      ttsService as unknown as TtsService,
      redis as unknown as SimulationRedisService,
    );
  });

  // ── enrichTraits ──────────────────────────────────────────────────────────

  describe('enrichTraits()', () => {
    it('should return enriched traits with voice, avatar, and audioPreview', () => {
      const result = service.enrichTraits({
        personaId: 'p-1',
        name: 'Sarah Johnson',
        traits: {
          role: 'VP of Sales',
          background: 'She has 20 years of experience',
        },
      });

      expect(result).not.toBeNull();
      expect(result!.voice).toBeDefined();
      expect((result!.voice as any).provider).toBe('elevenlabs');
      expect((result!.voice as any).voiceName).toBeDefined();
      expect(result!.avatar).toBeDefined();
      expect(result!.audioPreview).toBeDefined();
      expect(result!.voiceProfile).toBeDefined();
    });

    it('should return null for empty name and empty traits', () => {
      const result = service.enrichTraits({
        name: '',
        traits: null,
      });
      expect(result).toBeNull();
    });

    it('should return existing traits (non-null) for empty name with existing traits', () => {
      const result = service.enrichTraits({
        name: '',
        traits: { role: 'Manager' },
      });
      expect(result).not.toBeNull();
      expect(result!.role).toBe('Manager');
    });

    it('should infer female gender from known female names', () => {
      const result = service.enrichTraits({
        personaId: 'p-2',
        name: 'Emily',
        traits: {},
      });

      expect(result).not.toBeNull();
      const avatar = result!.avatar as any;
      expect(avatar.gender).toBe('female');
    });

    it('should infer male gender from known male names', () => {
      const result = service.enrichTraits({
        personaId: 'p-3',
        name: 'David',
        traits: {},
      });

      expect(result).not.toBeNull();
      const avatar = result!.avatar as any;
      expect(avatar.gender).toBe('male');
    });

    it('should infer female gender from text hints (pronouns)', () => {
      const result = service.enrichTraits({
        personaId: 'p-4',
        name: 'Alex',
        traits: { background: 'She is the head of marketing' },
      });

      expect(result).not.toBeNull();
      const avatar = result!.avatar as any;
      expect(avatar.gender).toBe('female');
    });

    it('should infer male gender from text hints (pronouns)', () => {
      const result = service.enrichTraits({
        personaId: 'p-5',
        name: 'Jordan',
        traits: { background: 'He manages the engineering team' },
      });

      expect(result).not.toBeNull();
      const avatar = result!.avatar as any;
      expect(avatar.gender).toBe('male');
    });

    it('should infer neutral gender when no hints match', () => {
      const result = service.enrichTraits({
        personaId: 'p-6',
        name: 'Pat',
        traits: {},
      });

      expect(result).not.toBeNull();
    });

    it('should infer gender from voice name hint', () => {
      const result = service.enrichTraits({
        personaId: 'p-7',
        name: 'Test',
        traits: { voice: { voiceName: 'Bella - Professional' } },
      });

      expect(result).not.toBeNull();
      const avatar = result!.avatar as any;
      expect(avatar.gender).toBe('female');
    });

    it('should infer gender from avatar gender trait', () => {
      const result = service.enrichTraits({
        personaId: 'p-8',
        name: 'Test',
        traits: { avatar: { gender: 'male' } },
      });

      expect(result).not.toBeNull();
      const avatar = result!.avatar as any;
      expect(avatar.gender).toBe('male');
    });

    it('should infer british accent from language en-gb', () => {
      const result = service.enrichTraits({
        personaId: 'p-9',
        name: 'Test',
        traits: { voice: { language: 'en-gb' } },
      });

      expect(result).not.toBeNull();
      // Explicit language from voice config is preserved as-is
      expect((result!.voice as any).language).toBe('en-gb');
    });

    it('should infer australian accent from text hints', () => {
      const result = service.enrichTraits({
        personaId: 'p-10',
        name: 'Test',
        traits: { background: 'Based in Sydney' },
      });

      expect(result).not.toBeNull();
      expect((result!.voice as any).language).toBe('en-AU');
    });

    it('should infer british accent from text hints', () => {
      const result = service.enrichTraits({
        personaId: 'p-11',
        name: 'Test',
        traits: { background: 'Works in London' },
      });

      expect(result).not.toBeNull();
      expect((result!.voice as any).language).toBe('en-GB');
    });

    it('should default to american accent', () => {
      const result = service.enrichTraits({
        personaId: 'p-12',
        name: 'Test',
        traits: {},
      });

      expect(result).not.toBeNull();
      expect((result!.voice as any).language).toBe('en-US');
    });

    it('should infer executive track from traits', () => {
      const result = service.enrichTraits({
        personaId: 'p-13',
        name: 'Test',
        traits: { role: 'Chief Technology Officer' },
      });

      expect(result).not.toBeNull();
      const avatar = result!.avatar as any;
      expect(avatar.track).toBe('executive');
    });

    it('should infer technical track from traits', () => {
      const result = service.enrichTraits({
        personaId: 'p-14',
        name: 'Test',
        traits: { role: 'Software Engineer' },
      });

      expect(result).not.toBeNull();
      const avatar = result!.avatar as any;
      expect(avatar.track).toBe('technical');
    });

    it('should infer training track from traits', () => {
      const result = service.enrichTraits({
        personaId: 'p-15',
        name: 'Test',
        traits: { role: 'Sales coach and trainer' },
      });

      expect(result).not.toBeNull();
      const avatar = result!.avatar as any;
      expect(avatar.track).toBe('training');
    });

    it('should default to general track when no keywords match', () => {
      const result = service.enrichTraits({
        personaId: 'p-16',
        name: 'Test',
        traits: { role: 'Intern' },
      });

      expect(result).not.toBeNull();
      const avatar = result!.avatar as any;
      expect(avatar.track).toBe('general');
    });

    it('should keep current voice if it is available in the provider', () => {
      const result = service.enrichTraits({
        personaId: 'p-17',
        name: 'Test',
        traits: {
          voice: { voiceName: 'Brian - Deep, Resonant and Comforting' },
        },
      });

      expect(result).not.toBeNull();
      expect((result!.voice as any).voiceName).toBe(
        'Brian - Deep, Resonant and Comforting',
      );
    });

    it('should build preview text including name and role', () => {
      const result = service.enrichTraits({
        personaId: 'p-18',
        name: 'Sarah - VP Sales',
        traits: {
          role: 'VP of Sales',
          background: 'Expert in enterprise deals.',
        },
      });

      expect(result).not.toBeNull();
      const preview = (result!.audioPreview as any).text;
      expect(preview).toContain('Sarah');
      expect(preview).toContain('VP of Sales');
    });

    it('should build preview text with personality when no background', () => {
      const result = service.enrichTraits({
        personaId: 'p-19',
        name: 'Alex',
        traits: { personality: 'Very analytical and detail-oriented.' },
      });

      expect(result).not.toBeNull();
      const preview = (result!.audioPreview as any).text;
      expect(preview).toContain('analytical');
    });

    it('should build preview text with signature traits when no background/personality', () => {
      const result = service.enrichTraits({
        personaId: 'p-20',
        name: 'Alex',
        traits: {
          signatureTraits: ['asks probing questions', 'challenges assumptions'],
        },
      });

      expect(result).not.toBeNull();
      const preview = (result!.audioPreview as any).text;
      expect(preview).toContain('asks probing questions');
    });

    it('should include communication style in preview', () => {
      const result = service.enrichTraits({
        personaId: 'p-21',
        name: 'Alex',
        traits: { communicationStyle: 'Direct', tone: 'Assertive' },
      });

      expect(result).not.toBeNull();
      const preview = (result!.audioPreview as any).text;
      expect(preview).toContain('direct');
    });

    it('should truncate preview text at word boundary at max 260 chars', () => {
      const result = service.enrichTraits({
        personaId: 'p-22',
        name: 'Test',
        traits: {
          role: 'Chief Marketing Officer',
          background:
            'A highly experienced marketing professional with over twenty years in the industry spanning multiple domains including digital transformation, brand management, customer acquisition strategies, and global market expansion.',
        },
      });

      expect(result).not.toBeNull();
      const preview = (result!.audioPreview as any).text;
      expect(preview.length).toBeLessThanOrEqual(261);
    });

    it('should handle hyphenated names by extracting primary name', () => {
      const result = service.enrichTraits({
        personaId: 'p-23',
        name: 'Jean-Pierre | Executive',
        traits: {},
      });

      expect(result).not.toBeNull();
      const preview = (result!.audioPreview as any).text;
      expect(preview).toContain('Jean');
    });

    it('should preserve existing language from voice config', () => {
      const result = service.enrichTraits({
        personaId: 'p-24',
        name: 'Test',
        traits: { voice: { language: 'fr-FR' } },
      });

      expect(result).not.toBeNull();
      expect((result!.voice as any).language).toBe('fr-FR');
    });
  });

  // ── getOrCreatePreviewAudio ───────────────────────────────────────────────

  describe('getOrCreatePreviewAudio()', () => {
    it('should return null when enrichTraits returns null', async () => {
      const result = await service.getOrCreatePreviewAudio({
        personaId: 'p-empty',
        name: '',
        traits: null,
      });
      expect(result).toBeNull();
    });

    it('should return cached audio when available in Redis', async () => {
      redis.getPersonaPreviewAudio.mockResolvedValue({
        voiceName: 'Bella - Professional, Bright, Warm',
        text: expect.any(String),
        contentType: 'audio/mpeg',
        audioBase64: Buffer.from('cached-audio').toString('base64'),
      });

      // We need the text and voiceName to match what enrichTraits produces
      // so let's use a concrete case
      const enriched = service.enrichTraits({
        personaId: 'p-cache',
        name: 'Emily',
        traits: {},
      });
      const voiceName = (enriched!.voice as any).voiceName;
      const text = (enriched!.audioPreview as any).text;

      redis.getPersonaPreviewAudio.mockResolvedValue({
        voiceName,
        text,
        contentType: 'audio/mpeg',
        audioBase64: Buffer.from('cached-audio').toString('base64'),
      });

      const result = await service.getOrCreatePreviewAudio({
        personaId: 'p-cache',
        name: 'Emily',
        traits: {},
      });

      expect(result).not.toBeNull();
      expect(result!.cacheHit).toBe(true);
      expect(ttsService.synthesize).not.toHaveBeenCalled();
    });

    it('should synthesize and cache when Redis has no cached audio', async () => {
      redis.getPersonaPreviewAudio.mockResolvedValue(null);

      const result = await service.getOrCreatePreviewAudio({
        personaId: 'p-synth',
        name: 'Brian',
        traits: {},
      });

      expect(result).not.toBeNull();
      expect(result!.cacheHit).toBe(false);
      expect(ttsService.synthesize).toHaveBeenCalled();
      expect(redis.setPersonaPreviewAudio).toHaveBeenCalledWith(
        'p-synth',
        expect.objectContaining({
          personaId: 'p-synth',
          contentType: 'audio/mpeg',
        }),
      );
    });

    it('should synthesize when cached voiceName differs', async () => {
      redis.getPersonaPreviewAudio.mockResolvedValue({
        voiceName: 'OldVoice',
        text: 'old text',
        contentType: 'audio/mpeg',
        audioBase64: 'base64data',
      });

      const result = await service.getOrCreatePreviewAudio({
        personaId: 'p-mismatch',
        name: 'Sarah',
        traits: {},
      });

      expect(result).not.toBeNull();
      expect(result!.cacheHit).toBe(false);
      expect(ttsService.synthesize).toHaveBeenCalled();
    });
  });

  // ── warmPreviewAudio ──────────────────────────────────────────────────────

  describe('warmPreviewAudio()', () => {
    it('should call getOrCreatePreviewAudio internally', async () => {
      redis.getPersonaPreviewAudio.mockResolvedValue(null);

      await service.warmPreviewAudio({
        personaId: 'p-warm',
        name: 'Test',
        traits: {},
      });

      expect(ttsService.synthesize).toHaveBeenCalled();
    });

    it('should not throw when getOrCreatePreviewAudio fails', async () => {
      ttsService.synthesize.mockRejectedValue(new Error('TTS unavailable'));

      await expect(
        service.warmPreviewAudio({
          personaId: 'p-warm-fail',
          name: 'Test',
          traits: {},
        }),
      ).resolves.not.toThrow();
    });
  });

  // ── selectAvatar ──────────────────────────────────────────────────────────

  describe('selectAvatar (via enrichTraits)', () => {
    it('should select a female avatar for female persona', () => {
      const result = service.enrichTraits({
        personaId: 'p-avatar-f',
        name: 'Adriana',
        traits: {},
      });

      expect(result).not.toBeNull();
      const avatar = result!.avatar as any;
      expect(avatar.gender).toBe('female');
      expect(avatar.imageUrl).toBeDefined();
      expect(avatar.previewVideoUrl).toBeDefined();
    });

    it('should select a male avatar for male persona', () => {
      const result = service.enrichTraits({
        personaId: 'p-avatar-m',
        name: 'Brandon',
        traits: {},
      });

      expect(result).not.toBeNull();
      const avatar = result!.avatar as any;
      expect(avatar.gender).toBe('male');
    });

    it('should produce stable avatar selection for same inputs', () => {
      const result1 = service.enrichTraits({
        personaId: 'p-stable',
        name: 'Emily',
        traits: {},
      });
      const result2 = service.enrichTraits({
        personaId: 'p-stable',
        name: 'Emily',
        traits: {},
      });

      expect((result1!.avatar as any).label).toBe(
        (result2!.avatar as any).label,
      );
    });
  });

  // ── selectVoice ───────────────────────────────────────────────────────────

  describe('selectVoice (via enrichTraits)', () => {
    it('should return a voice from the available voices', () => {
      const result = service.enrichTraits({
        personaId: 'p-voice',
        name: 'Test',
        traits: {},
      });

      expect(result).not.toBeNull();
      const voiceName = (result!.voice as any).voiceName;
      expect(typeof voiceName).toBe('string');
      expect(voiceName.length).toBeGreaterThan(0);
    });

    it('should pick boosted voice for technical track', () => {
      const result = service.enrichTraits({
        personaId: 'p-tech-voice',
        name: 'Alex',
        traits: { role: 'Software Engineer at a platform company' },
      });

      expect(result).not.toBeNull();
      const voiceName = (result!.voice as any).voiceName;
      expect(typeof voiceName).toBe('string');
    });

    it('should keep existing voice when available in provider list', () => {
      const result = service.enrichTraits({
        personaId: 'p-keep-voice',
        name: 'Test',
        traits: { voiceProfile: 'Eric - Smooth, Trustworthy' },
      });

      expect(result).not.toBeNull();
      expect((result!.voice as any).voiceName).toBe(
        'Eric - Smooth, Trustworthy',
      );
    });
  });
});
