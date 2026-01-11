import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { STTProviderRegistry } from '../../providers/stt/stt-provider.registry';
import {
  STTRequest,
  STTResult,
  STTPartialResult,
} from '../../providers/stt/stt-provider.interface';

@Injectable()
export class STTService {
  constructor(private readonly registry: STTProviderRegistry) {}

  async transcribe(request: STTRequest): Promise<STTResult> {
    const provider = request.provider
      ? this.registry.getProvider(request.provider)
      : this.registry.getDefaultProvider();

    return provider.transcribe(request);
  }

  stream(request: STTRequest): Observable<STTPartialResult> {
    const provider = request.provider
      ? this.registry.getProvider(request.provider)
      : this.registry.getDefaultProvider();

    if (!provider.stream) {
      throw new Error(
        `STT provider ${provider.name} does not support streaming`,
      );
    }

    return provider.stream(request);
  }
}
