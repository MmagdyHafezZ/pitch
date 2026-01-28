export interface ISTTProvider {
  readonly name: string;
  supportsModel(model: string): boolean;
  transcribe(
    audio: Buffer | Uint8Array | string,
    options?: Record<string, unknown>,
  ): Promise<string>;
}
