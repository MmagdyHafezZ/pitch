import { extractTtsConfig, resolveTtsConfig } from '../tts-config';

describe('tts-config utility', () => {
  it('extracts provider, voice, language, and model from nested voice config', () => {
    expect(
      extractTtsConfig({
        ttsProvider: 'ignored',
        voice: {
          provider: 'openai',
          voiceName: 'alloy',
          language: 'en-US',
          model: 'gpt-4o-mini-tts',
        },
      }),
    ).toEqual({
      provider: 'openai',
      voice: 'alloy',
      language: 'en-US',
      model: 'gpt-4o-mini-tts',
    });
  });

  it('prefers overrides, then persona traits, then session config', () => {
    expect(
      resolveTtsConfig({
        sessionConfig: {
          ttsProvider: 'elevenlabs',
          ttsVoice: 'Rachel',
          ttsModel: 'legacy-session-model',
          language: 'en-GB',
        },
        personaTraits: {
          voice: {
            provider: 'openai',
            voiceName: 'alloy',
            language: 'en-US',
            model: 'gpt-4o-mini-tts',
          },
        },
        override: {
          provider: 'openai',
          voice: 'sage',
          model: 'tts-1-hd',
        },
      }),
    ).toEqual({
      provider: 'openai',
      voice: 'sage',
      language: 'en-US',
      model: 'tts-1-hd',
    });
  });

  it('falls back to the default provider when no config is present', () => {
    expect(resolveTtsConfig({ sessionConfig: {} })).toEqual({
      provider: 'elevenlabs',
      voice: undefined,
      language: undefined,
      model: undefined,
    });
  });
});
