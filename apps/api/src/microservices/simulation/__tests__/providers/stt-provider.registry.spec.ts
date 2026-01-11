import { STTProviderRegistry } from '../../providers/stt/stt-provider.registry';
import { ISTTProvider } from '../../providers/stt/stt-provider.interface';

describe('STTProviderRegistry', () => {
  it('registers and returns providers', () => {
    const registry = new STTProviderRegistry();
    const provider: ISTTProvider = {
      name: 'mock',
      supportsModel: () => true,
      transcribe: jest.fn(),
    };

    registry.register(provider);

    expect(registry.listProviders()).toEqual(['mock']);
    expect(registry.getProvider('mock')).toBe(provider);
    expect(registry.getDefaultProvider()).toBe(provider);
  });
});
