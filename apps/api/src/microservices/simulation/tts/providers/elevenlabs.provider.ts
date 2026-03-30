import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import {
  TtsProvider,
  TtsOptions,
  TtsResult,
  TtsStreamResult,
} from './tts.provider';
import { inferLanguageCode } from '../../utils/voice-accent';

type ElevenVoice = { voice_id: string; name: string };
type ElevenLabsContext = { apiKey: string; client: ElevenLabsClient };

const DEFAULT_PCM_SAMPLE_RATE = 24000;
const ELEVENLABS_VOICES_URL = 'https://api.elevenlabs.io/v1/voices';
const ELEVENLABS_KEY_ERROR =
  'ELEVENLABS_API_KEY is not configured. Set ELEVENLABS_API_KEY or ELEVENLABS_API_KEYS.';
const MISSING_DEFAULT_VOICE_ERROR =
  'No voice specified and no default voice available. Please specify a voice or configure ELEVENLABS_DEFAULT_VOICE.';

@Injectable()
export class ElevenLabsTtsProvider implements TtsProvider {
  readonly name = 'elevenlabs';
  readonly description = 'ElevenLabs neural text-to-speech';
  private readonly logger = new Logger(ElevenLabsTtsProvider.name);

  private readonly apiKeys: string[];
  private readonly configuredDefaultVoice: string | undefined;
  private readonly modelId: string;
  private readonly outputFormat: string;
  private readonly clientsByApiKey: Map<string, ElevenLabsClient>;
  private preferredApiKeyIndex = 0;

  private voiceNameToIdByApiKey = new Map<string, Map<string, string>>();
  private voicesCacheByApiKey = new Map<string, string[]>();
  private voicesCache: string[] = [];

  constructor(private readonly config: ConfigService) {
    this.apiKeys = this.resolveApiKeys();
    if (this.apiKeys.length === 0) {
      throw new Error(ELEVENLABS_KEY_ERROR);
    }

    this.configuredDefaultVoice = this.config.get<string>(
      'ELEVENLABS_DEFAULT_VOICE',
    );

    this.modelId =
      this.config.get<string>('ELEVENLABS_MODEL_ID') || 'eleven_v2_flash';

    this.outputFormat =
      this.config.get<string>('ELEVENLABS_OUTPUT_FORMAT') || 'mp3_44100_128';

    this.clientsByApiKey = new Map(
      this.apiKeys.map((apiKey) => [apiKey, new ElevenLabsClient({ apiKey })]),
    );

    this.ensureVoicesLoaded().catch(() => {});
  }

  get voices(): string[] {
    return this.voicesCache;
  }

  async synthesize(text: string, options?: TtsOptions): Promise<TtsResult> {
    try {
      const resolvedOutputFormat = this.resolveOutputFormat(options);
      const outputFormat = resolvedOutputFormat as Parameters<
        ElevenLabsClient['textToSpeech']['convert']
      >[1]['outputFormat'];
      const contentType = this.resolveContentType(resolvedOutputFormat);
      const languageCode = this.resolveLanguageCode(options);

      const audioBuffer = await this.withApiKeyFailover(
        async ({ apiKey, client }) => {
          const voiceId = await this.resolveVoiceIdForApiKey(apiKey, options);
          const request: Parameters<
            ElevenLabsClient['textToSpeech']['convert']
          >[1] = {
            text,
            modelId: this.modelId,
            outputFormat,
            ...(languageCode ? { languageCode } : {}),
          };
          const audioStream = await client.textToSpeech.convert(
            voiceId,
            request,
          );

          return this.readWebStreamToBuffer(audioStream);
        },
      );

      return {
        audioBuffer,
        contentType,
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;

      throw new InternalServerErrorException('ElevenLabs TTS failed');
    }
  }

  /**
   * Streaming synthesis using ElevenLabs streaming API
   */
  async synthesizeStream(
    text: string,
    options?: TtsOptions,
  ): Promise<TtsStreamResult> {
    try {
      const resolvedOutputFormat = this.resolveOutputFormat(options);
      const outputFormat = resolvedOutputFormat as Parameters<
        ElevenLabsClient['textToSpeech']['stream']
      >[1]['outputFormat'];
      const contentType = this.resolveContentType(resolvedOutputFormat);
      const languageCode = this.resolveLanguageCode(options);

      const audioSource = await this.withApiKeyFailover(
        async ({ apiKey, client }) => {
          const voiceId = await this.resolveVoiceIdForApiKey(apiKey, options);
          const request: Parameters<
            ElevenLabsClient['textToSpeech']['stream']
          >[1] = {
            text,
            modelId: this.modelId,
            outputFormat,
            ...(languageCode ? { languageCode } : {}),
          };
          return client.textToSpeech.stream(voiceId, request);
        },
      );

      const audioStream = this.normalizeToAsyncIterable(audioSource);
      return { audioStream, contentType };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;

      throw new InternalServerErrorException('ElevenLabs streaming TTS failed');
    }
  }

  /**
   * Normalize either a Web ReadableStream or an async iterable into an async iterable of Uint8Array
   */
  private normalizeToAsyncIterable(source: unknown): AsyncIterable<Uint8Array> {
    if (source == null) {
      throw new InternalServerErrorException(
        'Empty audio stream from ElevenLabs',
      );
    }

    const bufferFromUnknown = (value: unknown): Buffer => {
      if (value == null) return Buffer.from('');
      if (typeof value === 'string') return Buffer.from(value);
      if (
        typeof value === 'number' ||
        typeof value === 'bigint' ||
        typeof value === 'boolean'
      ) {
        return Buffer.from(String(value));
      }
      if (typeof value === 'symbol') {
        return Buffer.from(value.description ?? '');
      }
      if (value instanceof Uint8Array) return Buffer.from(value);
      if (ArrayBuffer.isView(value)) {
        return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
      }
      if (value instanceof ArrayBuffer)
        return Buffer.from(new Uint8Array(value));
      try {
        const json = JSON.stringify(value);
        return Buffer.from(json ?? '');
      } catch {
        return Buffer.from('');
      }
    };

    // Web ReadableStream
    if (
      typeof source === 'object' &&
      source !== null &&
      'getReader' in source &&
      typeof (source as { getReader: unknown }).getReader === 'function'
    ) {
      const webStream = source as ReadableStream<Uint8Array>;
      const reader = webStream.getReader();
      return (async function* () {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) yield value;
        }
      })();
    }

    // Async iterable (for-await-of)
    if (
      typeof source === 'object' &&
      source !== null &&
      Symbol.asyncIterator in source &&
      typeof (source as { [Symbol.asyncIterator]?: unknown })[
        Symbol.asyncIterator
      ] === 'function'
    ) {
      return (async function* () {
        for await (const chunk of source as AsyncIterable<
          Uint8Array | ArrayBuffer | string | { data: unknown }
        >) {
          if (chunk instanceof Uint8Array) {
            yield chunk;
          } else if (ArrayBuffer.isView(chunk)) {
            yield new Uint8Array(
              chunk.buffer,
              chunk.byteOffset,
              chunk.byteLength,
            );
          } else if (chunk instanceof ArrayBuffer) {
            yield new Uint8Array(chunk);
          } else if (typeof chunk === 'string') {
            yield Buffer.from(chunk);
          } else if (
            typeof chunk === 'object' &&
            chunk !== null &&
            'data' in chunk
          ) {
            // Some SDKs wrap chunk in an object
            const d = (chunk as { data: unknown }).data;
            if (d instanceof Uint8Array) yield d;
            else if (ArrayBuffer.isView(d))
              yield new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
            else if (d instanceof ArrayBuffer) yield new Uint8Array(d);
            else yield bufferFromUnknown(d);
          } else {
            yield bufferFromUnknown(chunk);
          }
        }
      })();
    }

    throw new InternalServerErrorException(
      'Unsupported audio stream from ElevenLabs',
    );
  }

  private resolveApiKeys(): string[] {
    const fromList = (this.config.get<string>('ELEVENLABS_API_KEYS') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const fromSingle = this.config.get<string>('ELEVENLABS_API_KEY');

    const uniqueKeys = new Set<string>(fromList);
    if (fromSingle?.trim()) {
      uniqueKeys.add(fromSingle.trim());
    }

    return [...uniqueKeys];
  }

  private getOrderedApiKeys(): string[] {
    if (
      this.preferredApiKeyIndex <= 0 ||
      this.preferredApiKeyIndex >= this.apiKeys.length
    ) {
      return [...this.apiKeys];
    }

    const preferredApiKey = this.apiKeys[this.preferredApiKeyIndex];
    return [
      preferredApiKey,
      ...this.apiKeys.filter((apiKey) => apiKey !== preferredApiKey),
    ];
  }

  private markApiKeySuccessful(apiKey: string): void {
    const index = this.apiKeys.indexOf(apiKey);
    if (index >= 0) {
      this.preferredApiKeyIndex = index;
    }
  }

  private getApiKeyOrdinal(apiKey: string): string {
    const index = this.apiKeys.indexOf(apiKey);
    if (index < 0) {
      return '?';
    }
    return `${index + 1}/${this.apiKeys.length}`;
  }

  private async withApiKeyFailover<T>(
    operation: (context: ElevenLabsContext) => Promise<T>,
  ): Promise<T> {
    const orderedApiKeys = this.getOrderedApiKeys();
    let lastError: unknown;

    for (let i = 0; i < orderedApiKeys.length; i += 1) {
      const apiKey = orderedApiKeys[i];
      const client = this.clientsByApiKey.get(apiKey);
      if (!client) {
        continue;
      }

      try {
        const result = await operation({ apiKey, client });
        this.markApiKeySuccessful(apiKey);
        return result;
      } catch (error) {
        lastError = error;
        const isLastAttempt = i === orderedApiKeys.length - 1;
        if (!isLastAttempt) {
          this.logger.warn(
            `ElevenLabs request failed for API key ${this.getApiKeyOrdinal(apiKey)}; trying next key.`,
          );
        }
      }
    }

    if (lastError) {
      if (lastError instanceof Error) {
        throw lastError;
      }
      throw new Error('ElevenLabs request failed with a non-Error rejection');
    }

    throw new Error(ELEVENLABS_KEY_ERROR);
  }

  private resolveLanguageCode(options?: TtsOptions): string | undefined {
    const fromLanguage = inferLanguageCode(options?.language);
    if (fromLanguage) {
      return fromLanguage;
    }

    return inferLanguageCode(options?.accent);
  }

  private async resolveVoiceIdForApiKey(
    apiKey: string,
    options?: TtsOptions,
  ): Promise<string> {
    const requested = options?.voice?.trim();
    if (requested) {
      return this.resolveVoiceIdForApiKeyInput(apiKey, requested);
    }

    const configuredDefault = this.configuredDefaultVoice?.trim();
    if (configuredDefault) {
      return this.resolveVoiceIdForApiKeyInput(apiKey, configuredDefault);
    }

    await this.ensureVoicesLoadedForApiKey(apiKey);
    const fallbackVoice = this.voicesCacheByApiKey.get(apiKey)?.[0];
    if (!fallbackVoice) {
      throw new BadRequestException(MISSING_DEFAULT_VOICE_ERROR);
    }

    const voiceNameToId =
      this.voiceNameToIdByApiKey.get(apiKey) ?? new Map<string, string>();
    return this.resolveVoiceId(fallbackVoice, voiceNameToId);
  }

  private async resolveVoiceIdForApiKeyInput(
    apiKey: string,
    input: string,
  ): Promise<string> {
    if (this.looksLikeVoiceId(input)) {
      return input;
    }

    await this.ensureVoicesLoadedForApiKey(apiKey);
    const voiceNameToId =
      this.voiceNameToIdByApiKey.get(apiKey) ?? new Map<string, string>();
    return this.resolveVoiceId(input, voiceNameToId);
  }

  private resolveVoiceId(
    input: string,
    voiceNameToId: Map<string, string>,
  ): string {
    if (voiceNameToId.has(input)) {
      return voiceNameToId.get(input)!;
    }

    const lower = input.toLowerCase();
    for (const [name, id] of voiceNameToId) {
      if (name.toLowerCase() === lower) return id;
    }

    if (this.looksLikeVoiceId(input)) {
      return input;
    }

    throw new BadRequestException(
      `Unknown ElevenLabs voice "${input}". Call /tts/voices?provider=elevenlabs to see valid voices.`,
    );
  }

  private looksLikeVoiceId(input: string): boolean {
    return /^[a-zA-Z0-9_-]{10,}$/.test(input);
  }

  private resolveOutputFormat(options?: TtsOptions): string {
    if (options?.format === 'pcm') {
      const sampleRate = options.sampleRate ?? DEFAULT_PCM_SAMPLE_RATE;
      return `pcm_${sampleRate}`;
    }

    if (options?.format === 'wav') {
      const sampleRate = options.sampleRate ?? 44100;
      return `wav_${sampleRate}`;
    }

    if (options?.format === 'mp3') {
      const sampleRate = options.sampleRate;
      if (sampleRate === 22050) return 'mp3_22050_32';
      if (sampleRate === 24000) return 'mp3_24000_48';
      if (sampleRate === 44100) return 'mp3_44100_128';
      return 'mp3_44100_128';
    }

    return this.outputFormat;
  }

  private resolveContentType(outputFormat: string): string {
    if (outputFormat.startsWith('mp3')) {
      return 'audio/mpeg';
    }

    if (outputFormat.startsWith('wav')) {
      return 'audio/wav';
    }

    if (outputFormat.startsWith('pcm')) {
      const sampleRate = Number(
        outputFormat.split('_')[1] ?? DEFAULT_PCM_SAMPLE_RATE,
      );
      return `audio/pcm;rate=${sampleRate};channels=1`;
    }

    if (outputFormat.startsWith('opus')) {
      return 'audio/ogg';
    }

    return 'application/octet-stream';
  }

  private async ensureVoicesLoaded(): Promise<void> {
    if (this.voicesCache.length > 0) {
      return;
    }

    await this.withApiKeyFailover(async ({ apiKey }) => {
      await this.ensureVoicesLoadedForApiKey(apiKey);
    });
  }

  private async ensureVoicesLoadedForApiKey(apiKey: string): Promise<void> {
    if (this.voiceNameToIdByApiKey.has(apiKey)) {
      return;
    }

    const resp = await fetch(ELEVENLABS_VOICES_URL, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(
        `Failed to fetch ElevenLabs voices ${resp.status}: ${errorText}`,
      );
    }

    const data = (await resp.json()) as { voices: ElevenVoice[] };

    const map = new Map<string, string>();
    const names: string[] = [];

    for (const v of data.voices ?? []) {
      map.set(v.name, v.voice_id);
      names.push(v.name);
    }

    this.voiceNameToIdByApiKey.set(apiKey, map);
    this.voicesCacheByApiKey.set(
      apiKey,
      names.sort((a, b) => a.localeCompare(b)),
    );
    this.refreshVoiceCache();
  }

  private refreshVoiceCache(): void {
    const merged = new Set<string>();
    for (const voices of this.voicesCacheByApiKey.values()) {
      for (const voice of voices) {
        merged.add(voice);
      }
    }
    this.voicesCache = [...merged].sort((a, b) => a.localeCompare(b));
  }

  /**
   * The ElevenLabs SDK returns a Web ReadableStream (like your snippet).
   * Convert it to a Node Buffer reliably.
   */
  private async readWebStreamToBuffer(
    stream: ReadableStream<Uint8Array>,
  ): Promise<Buffer> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }

    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Uint8Array(totalLength);

    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }

    return Buffer.from(merged);
  }
}
