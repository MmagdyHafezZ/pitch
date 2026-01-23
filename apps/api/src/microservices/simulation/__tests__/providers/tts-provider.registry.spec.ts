import { TTSProviderRegistry } from '../../providers/tts/tts-provider.registry';
import { ITTSProvider } from '../../providers/tts/tts-provider.interface';

describe('TTSProviderRegistry', () => {
  it('registers and returns providers', () => {
    const registry = new TTSProviderRegistry();
    const provider: ITTSProvider = {
      name: 'elevenlabs',
      supportsVoice: () => true,
      synthesize: jest.fn(),
    };

    registry.register(provider);

    expect(registry.listProviders()).toEqual(['elevenlabs']);
    expect(registry.getProvider('elevenlabs')).toBe(provider);
    expect(registry.getDefaultProvider()).toBe(provider);
  });

  it('throws when provider is missing', () => {
    const registry = new TTSProviderRegistry();

    expect(() => registry.getProvider('missing')).toThrow('not registered');
    expect(() => registry.getDefaultProvider()).toThrow(
      'Default TTS provider not registered',
    );
  });

  it('overwrites when registering duplicate providers', () => {
    const registry = new TTSProviderRegistry();
    const provider: ITTSProvider = {
      name: 'elevenlabs',
      supportsVoice: () => true,
      synthesize: jest.fn(),
    };

    registry.register(provider);
    registry.register(provider);

    expect(registry.listProviders()).toEqual(['elevenlabs']);
  });
});
