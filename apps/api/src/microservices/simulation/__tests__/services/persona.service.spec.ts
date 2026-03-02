import { BadRequestException } from '@nestjs/common';
import { PersonaService } from '../../services/persona.service';

const buildCreateDto = () => ({
  orgId: ' org_123 ',
  name: ' Arden - Skeptical CTO ',
  traits: {
    role: 'Chief Technology Officer',
    level: 'Senior',
    personality:
      'Detail-heavy, skeptical, and focused on architecture integrity.',
    background:
      'Owns platform decisions and expects implementation depth before agreeing.',
    tone: 'Professional',
    archetype: 'Technical Gatekeeper',
    patience: 'Medium',
    communicationStyle: 'Direct',
    signatureTraits: ['Asks for proof', 'Needs implementation detail'],
    metrics: {
      pacing: 61.4,
      empathy: '38',
    },
    voice: {
      provider: 'OPENAI',
      voiceName: 'alloy',
      language: 'en-US',
      model: 'gpt-4o-mini-tts',
    },
  },
});

describe('PersonaService', () => {
  const personaRepository = {
    create: jest.fn(),
  };
  const ttsService = {
    listProviders: jest.fn(() => [
      {
        name: 'openai',
        voices: ['alloy', 'sage'],
        models: ['gpt-4o-mini-tts', 'tts-1', 'tts-1-hd'],
      },
      {
        name: 'elevenlabs',
        voices: ['Rachel'],
        models: [],
      },
    ]),
  };

  const service = new PersonaService(
    personaRepository as never,
    ttsService as never,
  );

  beforeEach(() => {
    personaRepository.create.mockReset();
  });

  it('normalizes and validates persona payloads before persisting', async () => {
    const now = new Date('2026-03-02T00:00:00.000Z');
    personaRepository.create.mockResolvedValue({
      id: 'persona_1',
      orgId: 'org_123',
      name: 'Arden - Skeptical CTO',
      traits: {
        role: 'Chief Technology Officer',
      },
      createdAt: now,
      updatedAt: now,
    });

    await service.create(buildCreateDto());

    expect(personaRepository.create).toHaveBeenCalledWith({
      orgId: 'org_123',
      name: 'Arden - Skeptical CTO',
      traits: expect.objectContaining({
        role: 'Chief Technology Officer',
        signatureTraits: ['Asks for proof', 'Needs implementation detail'],
        voiceProfile: 'openai / alloy',
        metrics: {
          pacing: 61,
          empathy: 38,
        },
        voice: {
          provider: 'openai',
          voiceName: 'alloy',
          language: 'en-US',
          model: 'gpt-4o-mini-tts',
        },
      }),
    });
  });

  it('rejects unsupported models for the selected provider', async () => {
    const payload = buildCreateDto();
    payload.traits.voice.model = 'not-a-real-model';

    const promise = service.create(payload);

    await expect(promise).rejects.toThrow(BadRequestException);
    await expect(promise).rejects.toThrow(
      'Invalid model "not-a-real-model" for provider "openai"',
    );
  });

  it('rejects invalid voice language codes', async () => {
    const payload = buildCreateDto();
    payload.traits.voice.language = 'english-us';

    const promise = service.create(payload);

    await expect(promise).rejects.toThrow(BadRequestException);
    await expect(promise).rejects.toThrow(
      'traits.voice.language must use codes like en or en-US',
    );
  });
});
