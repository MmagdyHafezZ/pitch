import { STTProviderRegistry } from '../../stt/providers/stt-provider.registry';
import type { ISTTProvider } from '../../stt/providers/stt-provider.interface';

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

  it('throws when provider is missing', () => {
    const registry = new STTProviderRegistry();

    expect(() => {
      registry.getProvider('missing');
    }).toThrow('not registered');
    expect(() => {
      registry.getDefaultProvider();
    }).toThrow('No STT providers registered');
  });

  it('overwrites when registering duplicate providers', () => {
    const registry = new STTProviderRegistry();
    const provider: ISTTProvider = {
      name: 'mock',
      supportsModel: () => true,
      transcribe: jest.fn(),
    };

    registry.register(provider);
    registry.register(provider);

    expect(registry.listProviders()).toEqual(['mock']);
  });
});
