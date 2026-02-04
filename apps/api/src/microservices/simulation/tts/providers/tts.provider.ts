export interface TtsOptions {
  voice?: string;
  language?: string;
  format?: 'mp3' | 'wav' | 'ogg';
  sampleRate?: number;
  apiToken?: string;
}

export interface TtsResult {
  audioBuffer: Buffer;
  contentType: string;
}

export interface TtsStreamResult {
  audioStream: AsyncIterable<Uint8Array>;
  contentType: string;
}

export interface TtsProvider {
  readonly name: string;
  readonly description?: string;
  readonly voices?: string[];
  synthesize(text: string, options?: TtsOptions): Promise<TtsResult>;
  synthesizeStream?: (
    text: string,
    options?: TtsOptions,
  ) => Promise<TtsStreamResult>;
}
