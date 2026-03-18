export interface TtsOptions {
  voice?: string;
  model?: string;
  language?: string;
  format?: 'mp3' | 'wav' | 'ogg' | 'pcm';
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
  readonly models?: string[];
  synthesize(text: string, options?: TtsOptions): Promise<TtsResult>;
  synthesizeStream?: (
    text: string,
    options?: TtsOptions,
  ) => Promise<TtsStreamResult>;
}
