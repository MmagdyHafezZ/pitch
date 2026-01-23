import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { TtsProvider, TtsOptions, TtsResult } from './tts.provider';

type ElevenVoice = { voice_id: string; name: string };

@Injectable()
export class ElevenLabsTtsProvider implements TtsProvider {
  readonly name = 'elevenlabs';
  readonly description = 'ElevenLabs neural text-to-speech';

  private readonly apiKey: string;
  private readonly defaultVoice: string;
  private readonly modelId: string;
  private readonly outputFormat: string;

  private readonly client: ElevenLabsClient;

  // Cached voice directory
  private voiceNameToId: Map<string, string> | null = null;
  private voicesCache: string[] = [];

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.getOrThrow<string>('ELEVENLABS_API_KEY');
    this.defaultVoice =
      this.config.get<string>('ELEVENLABS_DEFAULT_VOICE') || 'Rachel';

    // Align with SDK naming
    this.modelId =
      this.config.get<string>('ELEVENLABS_MODEL_ID') || 'eleven_v2_flash';

    // Example: mp3_44100_128 (matches your snippet style)
    this.outputFormat =
      this.config.get<string>('ELEVENLABS_OUTPUT_FORMAT') || 'mp3_44100_128';

    // Initialize SDK client with explicit apiKey (recommended in Nest)
    this.client = new ElevenLabsClient({ apiKey: this.apiKey });
    // Preload voices
    this.ensureVoicesLoaded().catch((err) => {
      console.error('Failed to load ElevenLabs voices on startup:', err);
    });
  }

  // Expose names for your /tts/voices endpoint
  get voices(): string[] {
    return this.voicesCache;
  }

  async synthesize(text: string, options?: TtsOptions): Promise<TtsResult> {
    try {
      const requested = (options?.voice || this.defaultVoice).trim();
      const voiceId = this.resolveVoiceId(requested);

      // SDK call (matches your snippet conceptually)
      const audioStream = await this.client.textToSpeech.convert(voiceId, {
        text,
        modelId: this.modelId,
        outputFormat: this.outputFormat,
        // Optional: if you later extend TtsOptions with stability/similarity,
        // you can pass them here as well.
      });

      const audioBuffer = await this.readWebStreamToBuffer(audioStream);

      return {
        audioBuffer,
        contentType: this.outputFormat.startsWith('mp3')
          ? 'audio/mpeg'
          : 'application/octet-stream',
      };
    } catch (err) {
      // Preserve explicit BadRequestException behavior for unknown voices
      if (err instanceof BadRequestException) throw err;

      // If SDK throws a useful error, keep it visible in logs
      // but avoid leaking internals to client
      // eslint-disable-next-line no-console
      console.error('ElevenLabs TTS synthesis error:', err);

      throw new InternalServerErrorException('ElevenLabs TTS failed');
    }
  }

  private resolveVoiceId(input: string): string {
    // Exact name match
    if (this.voiceNameToId?.has(input)) {
      return this.voiceNameToId.get(input)!;
    }

    // Case-insensitive name match
    const lower = input.toLowerCase();
    for (const [name, id] of this.voiceNameToId ?? []) {
      if (name.toLowerCase() === lower) return id;
    }

    // If it looks like an ID, accept it and let ElevenLabs validate
    if (/^[a-zA-Z0-9_-]{10,}$/.test(input)) {
      return input;
    }

    throw new BadRequestException(
      `Unknown ElevenLabs voice "${input}". Call /tts/voices?provider=elevenlabs to see valid voices.`,
    );
  }

  private async ensureVoicesLoaded(): Promise<void> {
    if (this.voiceNameToId) return;

    const resp = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': this.apiKey,
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

    this.voiceNameToId = map;
    this.voicesCache = names.sort((a, b) => a.localeCompare(b));
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
