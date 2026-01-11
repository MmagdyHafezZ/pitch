import { Injectable } from '@nestjs/common';
import { TTSProviderRegistry } from '../../providers/tts/tts-provider.registry';
import {
  TTSRequest,
  TTSResponse,
} from '../../providers/tts/tts-provider.interface';

@Injectable()
export class TTSService {
  constructor(private readonly registry: TTSProviderRegistry) {}

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const provider = request.provider
      ? this.registry.getProvider(request.provider)
      : this.registry.getDefaultProvider();

    return provider.synthesize(request);
  }
}
