import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PersonaService } from '../../services/persona.service';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Shared mocks (recreated per-test where state matters)
// ---------------------------------------------------------------------------

const buildMocks = () => {
  const personaRepository = {
    create: jest.fn(),
    findMany: jest.fn(),
    findById: jest.fn(),
    findByOrgId: jest.fn(),
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

  const personaMediaService = {
    enrichTraits: jest.fn(),
    warmPreviewAudio: jest.fn(),
    getOrCreatePreviewAudio: jest.fn(),
  };

  personaMediaService.enrichTraits.mockImplementation(
    ({ traits }: { traits: Record<string, unknown> }) => ({
      ...traits,
      voiceProfile: 'openai / alloy',
      avatar: { imageUrl: 'https://example.com/avatar/example.webp' },
      audioPreview: {
        provider: 'openai',
        voiceName: 'alloy',
        text: "Hello, I'm Arden.",
      },
    }),
  );

  return { personaRepository, ttsService, personaMediaService };
};

const buildService = (
  overrides: Partial<ReturnType<typeof buildMocks>> = {},
) => {
  const mocks = { ...buildMocks(), ...overrides };
  const service = new PersonaService(
    mocks.personaRepository as never,
    mocks.ttsService as never,
    mocks.personaMediaService as never,
  );
  return { service, ...mocks };
};

const now = new Date('2026-03-24T00:00:00.000Z');

const stubPersona = (overrides: Record<string, unknown> = {}) => ({
  id: 'persona_1',
  orgId: 'org_123',
  name: 'Arden - Skeptical CTO',
  traits: { role: 'Chief Technology Officer' },
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

// ---------------------------------------------------------------------------
// create()
// ---------------------------------------------------------------------------

describe('PersonaService.create', () => {
  it('normalizes and validates persona payloads before persisting', async () => {
    const { service, personaRepository } = buildService();

    personaRepository.create.mockResolvedValue(stubPersona());

    await service.create(buildCreateDto());

    expect(personaRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org_123',
        name: 'Arden - Skeptical CTO',
        traits: expect.objectContaining({
          role: 'Chief Technology Officer',
          signatureTraits: ['Asks for proof', 'Needs implementation detail'],
          metrics: { pacing: 61, empathy: 38 },
        }),
      }),
    );
  });

  it('rejects unsupported models for the selected provider', async () => {
    const { service } = buildService();
    const payload = buildCreateDto();
    payload.traits.voice.model = 'not-a-real-model';

    await expect(service.create(payload)).rejects.toThrow(BadRequestException);
    await expect(service.create(payload)).rejects.toThrow(
      'Invalid model "not-a-real-model" for provider "openai"',
    );
  });

  it('rejects invalid voice language codes', async () => {
    const { service } = buildService();
    const payload = buildCreateDto();
    payload.traits.voice.language = 'english-us';

    await expect(service.create(payload)).rejects.toThrow(BadRequestException);
    await expect(service.create(payload)).rejects.toThrow(
      'traits.voice.language must use codes like en or en-US',
    );
  });

  it('throws when name is too short', async () => {
    const { service } = buildService();
    const payload = buildCreateDto();
    (payload as any).name = 'A'; // length < 2

    await expect(service.create(payload)).rejects.toThrow(BadRequestException);
  });

  it('throws when name is not a string', async () => {
    const { service } = buildService();
    const payload = buildCreateDto();
    (payload as any).name = 123;

    await expect(service.create(payload)).rejects.toThrow(BadRequestException);
  });

  it('throws when orgId is too short', async () => {
    const { service } = buildService();
    const payload = buildCreateDto();
    (payload as any).orgId = 'x'; // length < 2

    await expect(service.create(payload)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when traits is not an object', async () => {
    const { service } = buildService();
    const payload = buildCreateDto();
    (payload as any).traits = 'not-an-object';

    await expect(service.create(payload)).rejects.toThrow(BadRequestException);
    await expect(service.create(payload)).rejects.toThrow(
      'Persona traits must be an object',
    );
  });

  it('throws BadRequestException when traits is an array', async () => {
    const { service } = buildService();
    const payload = buildCreateDto();
    (payload as any).traits = ['role', 'level'];

    await expect(service.create(payload)).rejects.toThrow(BadRequestException);
  });

  it('throws when voice provider is not supported', async () => {
    const { service } = buildService();
    const payload = buildCreateDto();
    payload.traits.voice.provider = 'unknown-provider';

    await expect(service.create(payload)).rejects.toThrow(BadRequestException);
    await expect(service.create(payload)).rejects.toThrow(
      'Unsupported TTS provider "unknown-provider"',
    );
  });

  it('throws when voice name is invalid for provider', async () => {
    const { service } = buildService();
    const payload = buildCreateDto();
    payload.traits.voice.voiceName = 'nonexistent-voice';

    await expect(service.create(payload)).rejects.toThrow(BadRequestException);
    await expect(service.create(payload)).rejects.toThrow(
      'Invalid voice "nonexistent-voice" for provider "openai"',
    );
  });

  it('throws when voice is not an object', async () => {
    const { service } = buildService();
    const payload = buildCreateDto();
    (payload.traits as any).voice = 'openai/alloy';

    await expect(service.create(payload)).rejects.toThrow(BadRequestException);
    await expect(service.create(payload)).rejects.toThrow(
      'traits.voice must be an object',
    );
  });

  it('accepts voice config without optional language and model fields', async () => {
    const { service, personaRepository } = buildService();
    const payload = buildCreateDto();
    delete (payload.traits.voice as any).language;
    delete (payload.traits.voice as any).model;

    personaRepository.create.mockResolvedValue(stubPersona());

    await expect(service.create(payload)).resolves.not.toThrow();
  });

  it('accepts provider with empty models list and any model name', async () => {
    const { service, personaRepository } = buildService();
    const payload = buildCreateDto();
    // elevenlabs has models: [] — any model should be accepted
    payload.traits.voice.provider = 'ELEVENLABS';
    payload.traits.voice.voiceName = 'Rachel';
    (payload.traits.voice as any).model = 'any-model-name';

    personaRepository.create.mockResolvedValue(stubPersona());

    await expect(service.create(payload)).resolves.not.toThrow();
  });

  it('sets voiceProfile from provider+voiceName when voiceProfile trait is absent', async () => {
    const { service, personaRepository } = buildService();
    const payload = buildCreateDto();
    delete (payload.traits as any).voiceProfile;

    personaRepository.create.mockResolvedValue(stubPersona());

    await service.create(payload);

    const arg = personaRepository.create.mock.calls[0][0] as any;
    // voiceProfile should be auto-set to "openai / alloy"
    expect(arg.traits.voiceProfile).toBe('openai / alloy');
  });

  it('throws when signatureTraits contains too many items', async () => {
    const { service } = buildService();
    const payload = buildCreateDto();
    payload.traits.signatureTraits = ['a', 'b', 'c', 'd', 'e', 'f', 'g']; // > 6

    await expect(service.create(payload)).rejects.toThrow(BadRequestException);
  });

  it('throws when signatureTraits is not an array', async () => {
    const { service } = buildService();
    const payload = buildCreateDto();
    (payload.traits as any).signatureTraits = 'not-array';

    await expect(service.create(payload)).rejects.toThrow(BadRequestException);
  });

  it('throws when highlights is not an array', async () => {
    const { service } = buildService();
    const payload = buildCreateDto();
    (payload.traits as any).highlights = 'not-array';

    await expect(service.create(payload)).rejects.toThrow(BadRequestException);
  });

  it('throws when a metric value is out of 0-100 range', async () => {
    const { service } = buildService();
    const payload = buildCreateDto();
    (payload.traits as any).metrics = { pacing: 150 };

    await expect(service.create(payload)).rejects.toThrow(BadRequestException);
  });

  it('throws when metrics array entry is not an object', async () => {
    const { service } = buildService();
    const payload = buildCreateDto();
    (payload.traits as any).metrics = ['not-an-object'];

    await expect(service.create(payload)).rejects.toThrow(BadRequestException);
  });

  it('throws when metrics is neither object nor array', async () => {
    const { service } = buildService();
    const payload = buildCreateDto();
    (payload.traits as any).metrics = 'bad';

    await expect(service.create(payload)).rejects.toThrow(BadRequestException);
  });

  it('throws when metric key normalizes to empty string', async () => {
    const { service } = buildService();
    const payload = buildCreateDto();
    (payload.traits as any).metrics = { '!!!': 50 };

    await expect(service.create(payload)).rejects.toThrow(BadRequestException);
    await expect(service.create(payload)).rejects.toThrow(
      'Metric names must contain letters or numbers',
    );
  });

  it('accepts metrics as array of {label, value} objects', async () => {
    const { service, personaRepository } = buildService();
    const payload = buildCreateDto();
    (payload.traits as any).metrics = [
      { label: 'Pacing', value: 70 },
      { label: 'Empathy', value: 85 },
    ];

    personaRepository.create.mockResolvedValue(stubPersona());

    await expect(service.create(payload)).resolves.not.toThrow();
  });

  it('warms preview audio after persona is created', async () => {
    const { service, personaRepository, personaMediaService } = buildService();

    personaRepository.create.mockResolvedValue(stubPersona());

    await service.create(buildCreateDto());

    // warmPreviewAudio is called as void - just check it was invoked
    expect(personaMediaService.warmPreviewAudio).toHaveBeenCalledWith(
      expect.objectContaining({ personaId: 'persona_1' }),
    );
  });

  it('creates persona without traits when traits field is omitted', async () => {
    const { service, personaRepository } = buildService();
    const payload: any = { orgId: 'org_123', name: 'Simple Persona' };

    personaRepository.create.mockResolvedValue(stubPersona({ traits: null }));

    await expect(service.create(payload)).resolves.not.toThrow();

    expect(personaRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ traits: undefined }),
    );
  });

  it('removes empty string trait fields from the payload', async () => {
    const { service, personaRepository } = buildService();
    const payload = buildCreateDto();
    (payload.traits as any).tone = ''; // empty → should be removed

    personaRepository.create.mockResolvedValue(stubPersona());

    await service.create(payload);

    const arg = personaRepository.create.mock.calls[0][0] as any;
    expect(arg.traits.tone).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// findAll()
// ---------------------------------------------------------------------------

describe('PersonaService.findAll', () => {
  it('returns all personas when no orgId provided', async () => {
    const { service, personaRepository, personaMediaService } = buildService();

    personaRepository.findMany.mockResolvedValue([stubPersona()]);
    personaMediaService.enrichTraits.mockReturnValue({ role: 'CTO' });

    const result = await service.findAll();

    expect(personaRepository.findMany).toHaveBeenCalledWith(undefined);
    expect(result.total).toBe(1);
    expect(result.personas[0].id).toBe('persona_1');
  });

  it('filters by orgId when provided', async () => {
    const { service, personaRepository, personaMediaService } = buildService();

    personaRepository.findMany.mockResolvedValue([]);
    personaMediaService.enrichTraits.mockReturnValue({});

    await service.findAll('org_42');

    expect(personaRepository.findMany).toHaveBeenCalledWith({
      orgId: 'org_42',
    });
  });

  it('returns empty list when no personas exist', async () => {
    const { service, personaRepository } = buildService();

    personaRepository.findMany.mockResolvedValue([]);

    const result = await service.findAll();

    expect(result).toEqual({ personas: [], total: 0 });
  });
});

// ---------------------------------------------------------------------------
// findById()
// ---------------------------------------------------------------------------

describe('PersonaService.findById', () => {
  it('throws NotFoundException when persona does not exist', async () => {
    const { service, personaRepository } = buildService();

    personaRepository.findById.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.findById('missing')).rejects.toThrow(
      'Persona with ID missing not found',
    );
  });

  it('returns the persona mapped to DTO', async () => {
    const { service, personaRepository, personaMediaService } = buildService();

    personaRepository.findById.mockResolvedValue(stubPersona());
    personaMediaService.enrichTraits.mockReturnValue({ role: 'CTO' });

    const result = await service.findById('persona_1');

    expect(result.id).toBe('persona_1');
    expect(result.orgId).toBe('org_123');
  });
});

// ---------------------------------------------------------------------------
// findByOrgId()
// ---------------------------------------------------------------------------

describe('PersonaService.findByOrgId', () => {
  it('returns personas for the given orgId', async () => {
    const { service, personaRepository, personaMediaService } = buildService();

    personaRepository.findByOrgId.mockResolvedValue([stubPersona()]);
    personaMediaService.enrichTraits.mockReturnValue({ role: 'CTO' });

    const result = await service.findByOrgId('org_123');

    expect(personaRepository.findByOrgId).toHaveBeenCalledWith('org_123');
    expect(result.total).toBe(1);
  });

  it('returns empty list when org has no personas', async () => {
    const { service, personaRepository } = buildService();

    personaRepository.findByOrgId.mockResolvedValue([]);

    const result = await service.findByOrgId('org_empty');

    expect(result).toEqual({ personas: [], total: 0 });
  });
});

// ---------------------------------------------------------------------------
// getPreviewAudio()
// ---------------------------------------------------------------------------

describe('PersonaService.getPreviewAudio', () => {
  it('throws NotFoundException when persona does not exist', async () => {
    const { service, personaRepository } = buildService();

    personaRepository.findById.mockResolvedValue(null);

    await expect(service.getPreviewAudio('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns null when no audio is available', async () => {
    const { service, personaRepository, personaMediaService } = buildService();

    personaRepository.findById.mockResolvedValue(stubPersona());
    personaMediaService.getOrCreatePreviewAudio.mockResolvedValue(null);

    const result = await service.getPreviewAudio('persona_1');

    expect(result).toBeNull();
  });

  it('returns audio buffer and content type when audio exists', async () => {
    const { service, personaRepository, personaMediaService } = buildService();

    const audioBuffer = Buffer.from('fake-audio');
    personaRepository.findById.mockResolvedValue(stubPersona());
    personaMediaService.getOrCreatePreviewAudio.mockResolvedValue({
      audioBuffer,
      contentType: 'audio/mpeg',
    });

    const result = await service.getPreviewAudio('persona_1');

    expect(result).toEqual({ audioBuffer, contentType: 'audio/mpeg' });
  });

  it('calls getOrCreatePreviewAudio with correct persona info', async () => {
    const { service, personaRepository, personaMediaService } = buildService();

    const persona = stubPersona({ traits: { role: 'CTO' } });
    personaRepository.findById.mockResolvedValue(persona);
    personaMediaService.getOrCreatePreviewAudio.mockResolvedValue(null);

    await service.getPreviewAudio('persona_1');

    expect(personaMediaService.getOrCreatePreviewAudio).toHaveBeenCalledWith({
      personaId: 'persona_1',
      name: 'Arden - Skeptical CTO',
      traits: { role: 'CTO' },
    });
  });
});
