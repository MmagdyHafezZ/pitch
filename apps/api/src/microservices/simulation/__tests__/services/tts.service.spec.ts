import { TTSService } from '../../services/tts/tts.service';
import { TTSProviderRegistry } from '../../providers/tts/tts-provider.registry';
import { ITTSProvider } from '../../providers/tts/tts-provider.interface';

describe('TTSService', () => {
  it('uses default provider when none specified', async () => {
    const registry = new TTSProviderRegistry();
    const provider: ITTSProvider = {
      name: 'elevenlabs',
      supportsVoice: () => true,
      synthesize: jest.fn().mockResolvedValue({
        audioBuffer: Buffer.from('data'),
        format: 'mp3',
      }),
    };

    registry.register(provider);

    const service = new TTSService(registry);
    const response = await service.synthesize({ text: 'hello' });

    expect(response.format).toBe('mp3');
    expect(provider.synthesize).toHaveBeenCalled();
  });

  it('uses specified provider when provided', async () => {
    const registry = new TTSProviderRegistry();
    const provider: ITTSProvider = {
      name: 'custom',
      supportsVoice: () => true,
      synthesize: jest.fn().mockResolvedValue({
        audioBuffer: Buffer.from('data'),
        format: 'wav',
      }),
    };

    registry.register(provider);

    const service = new TTSService(registry);
    const response = await service.synthesize({
      text: 'hello',
      provider: 'custom',
    });

    expect(response.format).toBe('wav');
    expect(provider.synthesize).toHaveBeenCalled();
  });
});
