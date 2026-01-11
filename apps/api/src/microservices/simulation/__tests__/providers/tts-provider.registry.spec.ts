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
});
