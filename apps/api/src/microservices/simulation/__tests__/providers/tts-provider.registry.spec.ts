import { TtsProviderFactory } from '../../tts/providers/tts.factory';
import type { TtsProvider } from '../../tts/providers/tts.provider';

describe('TtsProviderFactory', () => {
  it('returns providers and defaults to the first provider', () => {
    const primary: TtsProvider = {
      name: 'elevenlabs',
      voices: ['Ada'],
      synthesize: jest.fn(),
    };
    const secondary: TtsProvider = {
      name: 'melo',
      description: 'MeloTTS',
      synthesize: jest.fn(),
    };

    const factory = new TtsProviderFactory([primary, secondary]);

    expect(factory.getProvider()).toBe(primary);
    expect(factory.getProvider('melo')).toBe(secondary);
    expect(factory.listProviders()).toEqual([
      { name: 'elevenlabs', description: undefined, voices: ['Ada'] },
      { name: 'melo', description: 'MeloTTS', voices: [] },
    ]);
    expect(factory.getVoices('elevenlabs')).toEqual(['Ada']);
    expect(factory.getVoices('melo')).toEqual([]);
  });

  it('throws when provider is missing', () => {
    const provider: TtsProvider = {
      name: 'elevenlabs',
      synthesize: jest.fn(),
    };
    const factory = new TtsProviderFactory([provider]);

    expect(() => factory.getProvider('missing')).toThrow('not registered');
  });
});
