import { STTService } from '../../services/stt/stt.service';
import { STTProviderRegistry } from '../../providers/stt/stt-provider.registry';
import { ISTTProvider } from '../../providers/stt/stt-provider.interface';

describe('STTService', () => {
  it('transcribes using default provider', async () => {
    const registry = new STTProviderRegistry();
    const provider: ISTTProvider = {
      name: 'mock',
      supportsModel: () => true,
      transcribe: jest.fn().mockResolvedValue({ text: 'hello' }),
    };

    registry.register(provider);

    const service = new STTService(registry);
    const result = await service.transcribe({ audioUrl: 's3://audio' });

    expect(result.text).toBe('hello');
  });

  it('throws when streaming is not supported', () => {
    const registry = new STTProviderRegistry();
    const provider: ISTTProvider = {
      name: 'mock',
      supportsModel: () => true,
      transcribe: jest.fn(),
    };

    registry.register(provider);

    const service = new STTService(registry);

    expect(() => service.stream({ audioUrl: 's3://audio' })).toThrow(
      'does not support streaming',
    );
  });

  it('streams when provider supports streaming', async () => {
    const registry = new STTProviderRegistry();
    const provider: ISTTProvider = {
      name: 'mock',
      supportsModel: () => true,
      transcribe: jest.fn(),
      stream: jest.fn().mockReturnValue({
        subscribe: ({ next, complete }: any) => {
          next({ text: 'partial' });
          complete();
        },
      }),
    };

    registry.register(provider);

    const service = new STTService(registry);
    const chunks: any[] = [];

    await new Promise<void>((resolve) => {
      service.stream({ audioUrl: 's3://audio' }).subscribe({
        next: (chunk) => chunks.push(chunk),
        complete: () => resolve(),
      });
    });

    expect(chunks[0].text).toBe('partial');
  });
});
