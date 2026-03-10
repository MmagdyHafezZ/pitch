import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/simulation-client';
import { TtsService } from '../tts/tts.service';
import { SimulationRedisService } from './redis/redis.service';

type JsonRecord = Record<string, unknown>;
type PersonaGender = 'female' | 'male' | 'neutral';
type PersonaAccent = 'american' | 'british' | 'australian';
type PersonaTrack = 'executive' | 'technical' | 'training' | 'general';

interface CuratedAvatarOption {
  label: string;
  gender: 'female' | 'male';
  imageUrl: string;
  previewVideoUrl: string;
  tracks: PersonaTrack[];
}

interface VoicePreferenceMap {
  female: Record<PersonaAccent, string[]>;
  male: Record<PersonaAccent, string[]>;
  neutral: Record<PersonaAccent, string[]>;
}

interface EnrichPersonaTraitsInput {
  personaId?: string;
  name: string;
  traits?: Prisma.JsonValue | Prisma.InputJsonValue | null;
}

interface PersonaPreviewAudioInput extends EnrichPersonaTraitsInput {
  personaId: string;
}

interface PersonaPreviewAudioResult {
  audioBuffer: Buffer;
  contentType: string;
  cacheHit: boolean;
  voiceName: string;
  text: string;
}

const CURATED_AVATARS: CuratedAvatarOption[] = [
  {
    label: 'Adriana BizTalk Front',
    gender: 'female',
    imageUrl:
      'https://files2.heygen.ai/avatar/v3/c3d1baaebbe84752b7a473373c6cd385_42780/preview_target.webp',
    previewVideoUrl:
      'https://files2.heygen.ai/avatar/v3/c3d1baaebbe84752b7a473373c6cd385_42780/preview_video_target.mp4',
    tracks: ['training', 'general'],
  },
  {
    label: 'Amelia Business Training Front',
    gender: 'female',
    imageUrl:
      'https://files2.heygen.ai/avatar/v3/20cf0b98ae164abdb4a814dab98e69ca_39260/preview_talk_3.webp',
    previewVideoUrl:
      'https://files2.heygen.ai/avatar/v3/20cf0b98ae164abdb4a814dab98e69ca_39260/preview_video_talk_3.mp4',
    tracks: ['training', 'executive'],
  },
  {
    label: 'Annie Office Sitting Front',
    gender: 'female',
    imageUrl:
      'https://files2.heygen.ai/avatar/v3/b5272572b25143fbb1af3b874a03bdaf_56020/preview_talk_2.webp',
    previewVideoUrl:
      'https://files2.heygen.ai/avatar/v3/b5272572b25143fbb1af3b874a03bdaf_56020/preview_video_talk_2.mp4',
    tracks: ['technical', 'general'],
  },
  {
    label: 'Sabine Office Front',
    gender: 'female',
    imageUrl:
      'https://files2.heygen.ai/avatar/v3/884f8cb7bf7f4be295519756d601e1c9_37120/preview_target.webp',
    previewVideoUrl:
      'https://files2.heygen.ai/avatar/v3/884f8cb7bf7f4be295519756d601e1c9_37120/preview_video_target.mp4',
    tracks: ['technical', 'general'],
  },
  {
    label: 'Seema Business Front',
    gender: 'female',
    imageUrl:
      'https://files2.heygen.ai/avatar/v3/be2e19842ffb406a994d78c624a05ada_47190/preview_target.webp',
    previewVideoUrl:
      'https://files2.heygen.ai/avatar/v3/be2e19842ffb406a994d78c624a05ada_47190/preview_video_target.mp4',
    tracks: ['executive', 'general'],
  },
  {
    label: 'Shirley Business Front',
    gender: 'female',
    imageUrl:
      'https://files2.heygen.ai/avatar/v3/44e21323366e4ec090e4842f22d809a3_45060/preview_target.webp',
    previewVideoUrl:
      'https://files2.heygen.ai/avatar/v3/44e21323366e4ec090e4842f22d809a3_45060/preview_video_target.mp4',
    tracks: ['executive', 'training'],
  },
  {
    label: 'Artur Office Front',
    gender: 'male',
    imageUrl:
      'https://files2.heygen.ai/avatar/v3/f0d69336d41f48359261cefc05678c38_37890/preview_talk_3.webp',
    previewVideoUrl:
      'https://files2.heygen.ai/avatar/v3/f0d69336d41f48359261cefc05678c38_37890/preview_video_talk_3.mp4',
    tracks: ['technical', 'general'],
  },
  {
    label: 'Bojan Business Training Front',
    gender: 'male',
    imageUrl:
      'https://files2.heygen.ai/avatar/v3/2823b7672add411f9152b61e9a35cb3e_39290/preview_talk_3.webp',
    previewVideoUrl:
      'https://files2.heygen.ai/avatar/v3/2823b7672add411f9152b61e9a35cb3e_39290/preview_video_talk_3.mp4',
    tracks: ['training', 'general'],
  },
  {
    label: 'Brandon Office Standing Front',
    gender: 'male',
    imageUrl:
      'https://files2.heygen.ai/avatar/v3/77f01bf4c99047b6a0c07bd4546edb29_56460/preview_talk_2.webp',
    previewVideoUrl:
      'https://files2.heygen.ai/avatar/v3/77f01bf4c99047b6a0c07bd4546edb29_56460/preview_video_talk_2.mp4',
    tracks: ['executive', 'general'],
  },
  {
    label: 'Shawn Business Front',
    gender: 'male',
    imageUrl:
      'https://files2.heygen.ai/avatar/v3/5393508e61154f86af3d5d303dcd0705_47810/preview_target.webp',
    previewVideoUrl:
      'https://files2.heygen.ai/avatar/v3/5393508e61154f86af3d5d303dcd0705_47810/preview_video_target.mp4',
    tracks: ['executive', 'training'],
  },
  {
    label: 'Teodor Office Front',
    gender: 'male',
    imageUrl:
      'https://files2.heygen.ai/avatar/v3/35eb79d55dae43c682a1226352b64553_38030/preview_target.webp',
    previewVideoUrl:
      'https://files2.heygen.ai/avatar/v3/35eb79d55dae43c682a1226352b64553_38030/preview_video_target.mp4',
    tracks: ['technical', 'general'],
  },
  {
    label: 'Vince Business Training Front',
    gender: 'male',
    imageUrl:
      'https://files2.heygen.ai/avatar/v3/0734f4397d5d45b380befb3aa5e22366_38890/preview_talk_3.webp',
    previewVideoUrl:
      'https://files2.heygen.ai/avatar/v3/0734f4397d5d45b380befb3aa5e22366_38890/preview_video_talk_3.mp4',
    tracks: ['training', 'executive'],
  },
];

const FEMALE_NAME_HINTS = new Set([
  'abigail',
  'adriana',
  'amelia',
  'angela',
  'anja',
  'ann',
  'annie',
  'bella',
  'caroline',
  'emily',
  'emma',
  'isabella',
  'jessica',
  'laura',
  'lily',
  'matilda',
  'mia',
  'olivia',
  'sabine',
  'sarah',
  'seema',
  'shirley',
  'sophia',
]);

const MALE_NAME_HINTS = new Set([
  'adam',
  'alex',
  'artur',
  'bojan',
  'brandon',
  'brian',
  'charlie',
  'chris',
  'daniel',
  'david',
  'eric',
  'ethan',
  'george',
  'james',
  'liam',
  'lucas',
  'michael',
  'oliver',
  'robert',
  'shawn',
  'teodor',
  'vince',
  'will',
]);

const FEMALE_TEXT_HINTS = [
  ' she ',
  ' her ',
  ' herself ',
  ' woman ',
  ' female ',
  ' mother ',
  ' mrs ',
  ' ms ',
  ' miss ',
  ' lady ',
];

const MALE_TEXT_HINTS = [
  ' he ',
  ' him ',
  ' himself ',
  ' man ',
  ' male ',
  ' father ',
  ' mr ',
  ' gentleman ',
];

const VOICE_GENDER_HINTS: Record<string, PersonaGender> = {
  alice: 'female',
  bella: 'female',
  jessica: 'female',
  laura: 'female',
  lily: 'female',
  matilda: 'female',
  sarah: 'female',
  adam: 'male',
  brian: 'male',
  charlie: 'male',
  chris: 'male',
  daniel: 'male',
  eric: 'male',
  george: 'male',
  liam: 'male',
  will: 'male',
  river: 'neutral',
};

const VOICE_PREFERENCES: VoicePreferenceMap = {
  female: {
    american: [
      'Bella - Professional, Bright, Warm',
      'Sarah - Mature, Reassuring, Confident',
      'Matilda - Knowledgable, Professional',
      'Alice - Clear, Engaging Educator',
    ],
    british: [
      'Alice - Clear, Engaging Educator',
      'Lily - Velvety Actress',
      'Bella - Professional, Bright, Warm',
    ],
    australian: [
      'Bella - Professional, Bright, Warm',
      'Sarah - Mature, Reassuring, Confident',
      'Alice - Clear, Engaging Educator',
    ],
  },
  male: {
    american: [
      'Eric - Smooth, Trustworthy',
      'Brian - Deep, Resonant and Comforting',
      'Adam - Dominant, Firm',
      'Daniel - Steady Broadcaster',
    ],
    british: [
      'Daniel - Steady Broadcaster',
      'George - Warm, Captivating Storyteller',
      'Eric - Smooth, Trustworthy',
    ],
    australian: [
      'Charlie - Deep, Confident, Energetic',
      'Eric - Smooth, Trustworthy',
      'Brian - Deep, Resonant and Comforting',
    ],
  },
  neutral: {
    american: [
      'River - Relaxed, Neutral, Informative',
      'Bella - Professional, Bright, Warm',
      'Eric - Smooth, Trustworthy',
    ],
    british: [
      'River - Relaxed, Neutral, Informative',
      'Daniel - Steady Broadcaster',
      'Alice - Clear, Engaging Educator',
    ],
    australian: [
      'River - Relaxed, Neutral, Informative',
      'Charlie - Deep, Confident, Energetic',
      'Bella - Professional, Bright, Warm',
    ],
  },
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toRecord = (value: unknown): JsonRecord => (isRecord(value) ? value : {});

const pickString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
};

const extractFirstSentence = (
  value: string | undefined,
): string | undefined => {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  const match = normalized.match(/^[^.!?]+[.!?]?/);
  return match?.[0]?.trim() ?? normalized;
};

const truncateAtWordBoundary = (value: string, maxLength: number): string => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const sliced = normalized.slice(0, Math.max(0, maxLength - 1));
  const boundary = sliced.lastIndexOf(' ');
  const next = (boundary > 0 ? sliced.slice(0, boundary) : sliced).trim();
  return `${next}.`;
};

const stableIndex = (seed: string, length: number): number => {
  if (length <= 1) return 0;
  const digest = createHash('sha256').update(seed).digest();
  return digest.readUInt32BE(0) % length;
};

const resolvePrimaryName = (value: string): string =>
  value
    .trim()
    .split(/\s*[-,|/]\s*/)[0]
    .trim();

@Injectable()
export class PersonaMediaService {
  private readonly logger = new Logger(PersonaMediaService.name);

  constructor(
    private readonly ttsService: TtsService,
    private readonly redis: SimulationRedisService,
  ) {}

  enrichTraits(input: EnrichPersonaTraitsInput): JsonRecord | null {
    const currentTraits = isRecord(input.traits) ? { ...input.traits } : {};
    if (!input.name.trim()) {
      return Object.keys(currentTraits).length > 0 ? currentTraits : null;
    }

    const gender = this.inferGender(input.name, currentTraits);
    const accent = this.inferAccent(currentTraits);
    const track = this.inferTrack(currentTraits);
    const avatar = this.selectAvatar({
      personaId: input.personaId,
      name: input.name,
      gender,
      track,
    });
    const currentAvatar = toRecord((currentTraits as JsonRecord).avatar);
    const language = this.resolveLanguage(currentTraits, accent);
    const voiceName = this.selectVoice({
      accent,
      gender,
      track,
      currentTraits,
    });
    const previewText = this.buildPreviewText(input.name, currentTraits);

    const nextVoice = {
      provider: 'elevenlabs',
      voiceName,
      language,
    };

    return {
      ...currentTraits,
      voice: nextVoice,
      voiceProfile: `ElevenLabs / ${voiceName}`,
      avatar: {
        label: avatar.label,
        imageUrl: avatar.imageUrl,
        previewVideoUrl: avatar.previewVideoUrl,
        gender: avatar.gender,
        track,
      },
      audioPreview: {
        provider: 'elevenlabs',
        voiceName,
        text: previewText,
      },
    };
  }

  async getOrCreatePreviewAudio(
    input: PersonaPreviewAudioInput,
  ): Promise<PersonaPreviewAudioResult | null> {
    const enrichedTraits = this.enrichTraits(input);
    if (!enrichedTraits) {
      return null;
    }

    const voice = toRecord(enrichedTraits.voice);
    const audioPreview = toRecord(enrichedTraits.audioPreview);
    const voiceName = pickString(audioPreview.voiceName, voice.voiceName);
    const text = pickString(audioPreview.text);
    const language = pickString(voice.language);

    if (!voiceName || !text) {
      return null;
    }

    const cached = await this.redis.getPersonaPreviewAudio(input.personaId);
    if (
      cached &&
      cached.voiceName === voiceName &&
      cached.text === text &&
      cached.contentType &&
      cached.audioBase64
    ) {
      return {
        audioBuffer: Buffer.from(cached.audioBase64, 'base64'),
        contentType: cached.contentType,
        cacheHit: true,
        voiceName,
        text,
      };
    }

    const result = await this.ttsService.synthesize(text, 'elevenlabs', {
      voice: voiceName,
      language,
    });

    await this.redis.setPersonaPreviewAudio(input.personaId, {
      personaId: input.personaId,
      voiceName,
      text,
      contentType: result.contentType,
      audioBase64: result.audioBuffer.toString('base64'),
      createdAt: new Date().toISOString(),
    });

    return {
      audioBuffer: result.audioBuffer,
      contentType: result.contentType,
      cacheHit: false,
      voiceName,
      text,
    };
  }

  async warmPreviewAudio(input: PersonaPreviewAudioInput): Promise<void> {
    try {
      await this.getOrCreatePreviewAudio(input);
    } catch (error) {
      this.logger.warn(
        `Unable to warm persona preview audio for ${input.personaId}: ${
          (error as Error)?.message ?? error
        }`,
      );
    }
  }

  private inferGender(name: string, traits: JsonRecord): PersonaGender {
    const currentAvatar = toRecord(traits.avatar);
    const avatarGender = pickString(currentAvatar.gender)?.toLowerCase();
    if (avatarGender === 'female' || avatarGender === 'male') {
      return avatarGender;
    }

    const voice = toRecord(traits.voice);
    const currentVoiceName = pickString(voice.voiceName, traits.voiceProfile);
    const voiceHint = currentVoiceName
      ? VOICE_GENDER_HINTS[
          currentVoiceName.trim().split(/\s+/)[0].toLowerCase()
        ]
      : undefined;
    if (voiceHint) {
      return voiceHint;
    }

    const text = ` ${[
      name,
      pickString(traits.role),
      pickString(traits.background),
      pickString(traits.personality),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()} `;
    const femaleScore = FEMALE_TEXT_HINTS.filter((hint) =>
      text.includes(hint),
    ).length;
    const maleScore = MALE_TEXT_HINTS.filter((hint) =>
      text.includes(hint),
    ).length;

    if (femaleScore > maleScore) return 'female';
    if (maleScore > femaleScore) return 'male';

    const firstName = resolvePrimaryName(name).split(/\s+/)[0]?.toLowerCase();
    if (firstName && FEMALE_NAME_HINTS.has(firstName)) return 'female';
    if (firstName && MALE_NAME_HINTS.has(firstName)) return 'male';

    return 'neutral';
  }

  private inferAccent(traits: JsonRecord): PersonaAccent {
    const voice = toRecord(traits.voice);
    const language = pickString(voice.language)?.toLowerCase();
    if (language === 'en-gb') return 'british';
    if (language === 'en-au') return 'australian';

    const text = ` ${[
      pickString(traits.background),
      pickString(traits.personality),
      pickString(traits.voiceProfile),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()} `;

    if (
      text.includes(' british ') ||
      text.includes(' london ') ||
      text.includes(' uk ') ||
      text.includes(' united kingdom ')
    ) {
      return 'british';
    }

    if (
      text.includes(' australian ') ||
      text.includes(' sydney ') ||
      text.includes(' melbourne ') ||
      text.includes(' anz ')
    ) {
      return 'australian';
    }

    return 'american';
  }

  private inferTrack(traits: JsonRecord): PersonaTrack {
    const text = ` ${[
      pickString(traits.role),
      pickString(traits.archetype),
      pickString(traits.background),
      pickString(traits.communicationStyle),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()} `;

    const scoreTrack = (
      keywords: string[],
      track: PersonaTrack,
    ): [PersonaTrack, number] => [
      track,
      keywords.reduce(
        (total, keyword) => total + (text.includes(keyword) ? 1 : 0),
        0,
      ),
    ];

    const scores: Array<[PersonaTrack, number]> = [
      scoreTrack(
        [
          'chief ',
          'vp',
          'vice president',
          'director',
          'head of',
          'legal',
          'finance',
          'procurement',
          'operations',
          'executive',
        ],
        'executive',
      ),
      scoreTrack(
        [
          'cto',
          'engineer',
          'developer',
          'architect',
          'technology',
          'technical',
          'product',
          'security',
          'data',
          'platform',
          'it ',
        ],
        'technical',
      ),
      scoreTrack(
        [
          'sales',
          'account executive',
          'customer success',
          'trainer',
          'coach',
          'enablement',
          'onboarding',
          'marketing',
          'people ops',
          'recruit',
          'support',
        ],
        'training',
      ),
    ];

    const [track, score] = scores.sort((left, right) => right[1] - left[1])[0];
    return score > 0 ? track : 'general';
  }

  private resolveLanguage(traits: JsonRecord, accent: PersonaAccent): string {
    const voice = toRecord(traits.voice);
    const explicitLanguage = pickString(voice.language);
    if (explicitLanguage) return explicitLanguage;

    if (accent === 'british') return 'en-GB';
    if (accent === 'australian') return 'en-AU';
    return 'en-US';
  }

  private selectAvatar(input: {
    personaId?: string;
    name: string;
    gender: PersonaGender;
    track: PersonaTrack;
  }): CuratedAvatarOption {
    const byGender =
      input.gender === 'neutral'
        ? CURATED_AVATARS
        : CURATED_AVATARS.filter((avatar) => avatar.gender === input.gender);
    const matchingTrack = byGender.filter((avatar) =>
      avatar.tracks.includes(input.track),
    );
    const pool = matchingTrack.length > 0 ? matchingTrack : byGender;
    return pool[
      stableIndex(
        `${input.personaId ?? input.name}:${input.track}`,
        pool.length,
      )
    ];
  }

  private selectVoice(input: {
    accent: PersonaAccent;
    gender: PersonaGender;
    track: PersonaTrack;
    currentTraits: JsonRecord;
  }): string {
    const availableVoices = new Set(
      this.ttsService.getVoices('elevenlabs').map((voice) => voice.trim()),
    );
    const currentVoice = pickString(
      toRecord(input.currentTraits.voice).voiceName,
      input.currentTraits.voiceProfile,
    );
    if (currentVoice && availableVoices.has(currentVoice)) {
      return currentVoice;
    }

    const voiceCandidates =
      VOICE_PREFERENCES[input.gender][input.accent] ??
      VOICE_PREFERENCES.neutral.american;
    const trackBoost =
      input.track === 'technical'
        ? ['Daniel - Steady Broadcaster', 'Eric - Smooth, Trustworthy']
        : input.track === 'executive'
          ? ['Eric - Smooth, Trustworthy', 'Bella - Professional, Bright, Warm']
          : input.track === 'training'
            ? [
                'Sarah - Mature, Reassuring, Confident',
                'Brian - Deep, Resonant and Comforting',
              ]
            : [];

    const ordered = [...trackBoost, ...voiceCandidates];
    for (const candidate of ordered) {
      if (availableVoices.size === 0 || availableVoices.has(candidate)) {
        return candidate;
      }
    }

    return ordered[0];
  }

  private buildPreviewText(name: string, traits: JsonRecord): string {
    const primaryName = resolvePrimaryName(name);
    const role = pickString(
      traits.role,
      traits.archetype,
      'professional counterpart',
    );
    const background = extractFirstSentence(pickString(traits.background));
    const personality = extractFirstSentence(pickString(traits.personality));
    const communicationStyle = pickString(traits.communicationStyle);
    const tone = pickString(traits.tone);
    const signatureTraits = Array.isArray(traits.signatureTraits)
      ? traits.signatureTraits
          .filter((trait): trait is string => typeof trait === 'string')
          .slice(0, 2)
          .join(' and ')
      : undefined;

    const parts = [`Hello, I'm ${primaryName}, your ${role}.`];

    if (background) {
      parts.push(background.endsWith('.') ? background : `${background}.`);
    } else if (personality) {
      parts.push(personality.endsWith('.') ? personality : `${personality}.`);
    } else if (signatureTraits) {
      parts.push(`I usually ${signatureTraits.toLowerCase()}.`);
    }

    if (communicationStyle || tone) {
      const style = [communicationStyle, tone]
        .filter(Boolean)
        .map((value) => value!.toLowerCase())
        .join(' and ');
      if (style) {
        parts.push(`Expect a ${style} conversation.`);
      }
    }

    return truncateAtWordBoundary(parts.join(' '), 260);
  }
}
