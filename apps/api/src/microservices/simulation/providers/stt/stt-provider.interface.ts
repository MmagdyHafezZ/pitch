import { Observable } from 'rxjs';

export interface STTRequest {
  audioUrl?: string;
  audioBuffer?: Buffer;
  language?: string;
  provider?: string;
  model?: string;
}

export interface STTPartialResult {
  text: string;
  isFinal?: boolean;
  confidence?: number;
  words?: Array<{
    word: string;
    startMs: number;
    endMs: number;
    confidence?: number;
  }>;
}

export interface STTResult {
  text: string;
  confidence?: number;
  language?: string;
  words?: Array<{
    word: string;
    startMs: number;
    endMs: number;
    confidence?: number;
  }>;
}

export interface ISTTProvider {
  readonly name: string;
  supportsModel(model?: string): boolean;
  transcribe(request: STTRequest): Promise<STTResult>;
  stream?(request: STTRequest): Observable<STTPartialResult>;
}

export class STTProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'STTProviderError';
  }
}
