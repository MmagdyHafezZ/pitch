export interface TtsOptions {
  voice?: string;
  language?: string;
  format?: 'mp3' | 'wav' | 'ogg';
  sampleRate?: number;
}

export interface TtsResult {
  audioBuffer: Buffer;
  contentType: string;
}

export interface TtsProvider {
  readonly name: string;
  synthesize(text: string, options?: TtsOptions): Promise<TtsResult>;
}
