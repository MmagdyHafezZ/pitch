import { Observable } from 'rxjs';

export interface STTStreamChunk {
  transcript: string;
  isFinal: boolean;
  confidence?: number;
  timestamp?: number;
}

export interface ISTTProvider {
  readonly name: string;
  supportsModel(model: string): boolean;

  /**
   * Batch transcription - transcribe complete audio file
   */
  transcribe(
    audio: Buffer | Uint8Array | string,
    options?: Record<string, unknown>,
  ): Promise<string>;

  /**
   * Streaming transcription - transcribe audio in real-time
   * Returns an Observable that emits partial and final transcripts
   */
  transcribeStream?(
    audioStream: AsyncIterable<Buffer | Uint8Array>,
    options?: Record<string, unknown>,
  ): Observable<STTStreamChunk>;

  /**
   * Check if this provider supports streaming
   */
  supportsStreaming?(): boolean;
}
