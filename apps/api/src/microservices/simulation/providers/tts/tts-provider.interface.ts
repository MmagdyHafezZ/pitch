export interface TTSRequest {
  text: string;
  voice?: string;
  provider?: string;
  model?: string;
  format?: string;
  speed?: number;
  pitch?: number;
}

export interface TTSResponse {
  audioBuffer: Buffer;
  format: string;
  durationMs?: number;
  costUsd?: number;
  providerMeta?: {
    requestId?: string;
  };
}

export interface ITTSProvider {
  readonly name: string;
  supportsVoice(voice?: string): boolean;
  synthesize(request: TTSRequest): Promise<TTSResponse>;
}

export class TTSProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'TTSProviderError';
  }
}

export class TTSProviderAuthError extends TTSProviderError {
  constructor(provider: string, details?: unknown) {
    super(provider, 'AUTH_ERROR', 'Authentication failed', details);
  }
}

export class TTSProviderRequestError extends TTSProviderError {
  constructor(provider: string, message: string, details?: unknown) {
    super(provider, 'INVALID_REQUEST', message, details);
  }
}
