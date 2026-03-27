import { Injectable, Logger } from '@nestjs/common';

type JsonRecord = Record<string, unknown>;

interface QueueAssistantVideoInput {
  sessionId: string;
  requestId: string;
  text: string;
  language?: string;
  ttsProvider: string;
  ttsVoice?: string;
  ttsModel?: string;
}

interface TurnAudioResult {
  audioBuffer: Buffer;
  contentType: string;
}

interface ResolvedVideoConfig {
  mode: 'rendered';
}

@Injectable()
export class VideoGenerationService {
  private readonly logger = new Logger(VideoGenerationService.name);

  resolveVideoConfig(
    _sessionConfig: JsonRecord,
    _personaTraits: JsonRecord | null,
  ): ResolvedVideoConfig {
    void _sessionConfig;
    void _personaTraits;
    // Avatar providers are intentionally disabled while a custom microservice is integrated.
    return { mode: 'rendered' };
  }

  queueAssistantVideo(_input: QueueAssistantVideoInput): Promise<void> {
    void _input;
    // No-op: provider-based avatar generation has been removed.
    return Promise.resolve();
  }

  getVideoAudioAsset(
    _jobId: string,
    _token: string,
  ): Promise<TurnAudioResult | null> {
    void _jobId;
    void _token;
    return Promise.resolve(null);
  }

  getVideoStreamResponse(
    _sessionId: string,
    _token: string,
    _rangeHeader?: string,
  ): Promise<Response | null> {
    void _sessionId;
    void _token;
    void _rangeHeader;
    return Promise.resolve(null);
  }

  handleHeyGenCallback(_payload: unknown): Promise<void> {
    void _payload;
    this.logger.debug(
      'Ignoring HeyGen webhook payload because integration is disabled.',
    );
    return Promise.resolve();
  }
}
