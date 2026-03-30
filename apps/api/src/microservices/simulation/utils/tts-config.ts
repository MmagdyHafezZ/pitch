import { normalizeAccent } from './voice-accent';

type JsonRecord = Record<string, unknown>;

export interface ResolvedTtsConfig {
  provider: string;
  voice?: string;
  language?: string;
  model?: string;
  accent?: string;
}

export interface TtsConfigOverride {
  provider?: string;
  voice?: string;
  language?: string;
  model?: string;
  accent?: string;
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const pickFirstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
};

export const extractTtsConfig = (
  source: JsonRecord | null | undefined,
): Partial<ResolvedTtsConfig> => {
  if (!source) {
    return {};
  }

  const voice = isRecord(source.voice) ? source.voice : undefined;
  const phone = isRecord(source.phone) ? source.phone : undefined;

  return {
    provider: pickFirstString(
      voice?.provider,
      source.ttsProvider,
      phone?.provider,
    ),
    voice: pickFirstString(voice?.voiceName, voice?.voice, source.ttsVoice),
    language: pickFirstString(voice?.language, source.language),
    model: pickFirstString(voice?.model, source.ttsModel),
    accent: pickFirstString(voice?.accent, source.accent),
  };
};

export const resolveTtsConfig = ({
  sessionConfig,
  personaTraits,
  override,
  defaultProvider = 'elevenlabs',
}: {
  sessionConfig: JsonRecord;
  personaTraits?: JsonRecord | null;
  override?: TtsConfigOverride;
  defaultProvider?: string;
}): ResolvedTtsConfig => {
  const sessionVoice = extractTtsConfig(sessionConfig);
  const personaVoice = extractTtsConfig(personaTraits);
  const accent = normalizeAccent(
    override?.accent ?? sessionVoice.accent ?? personaVoice.accent,
  );

  return {
    provider:
      override?.provider ??
      sessionVoice.provider ??
      personaVoice.provider ??
      defaultProvider,
    voice: override?.voice ?? sessionVoice.voice ?? personaVoice.voice,
    language:
      override?.language ?? sessionVoice.language ?? personaVoice.language,
    model: override?.model ?? sessionVoice.model ?? personaVoice.model,
    accent,
  };
};
