import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

type JsonRecord = Record<string, unknown>;
type VideoMode = 'rendered' | 'realtime';

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
  mode: VideoMode;
}

export interface LiveAvatarSessionTokenResult {
  sessionId: string;
  sessionToken: string;
  avatarId: string;
  avatarName: string;
  previewUrl?: string | null;
  mode: 'LITE';
  quality: 'very_high' | 'high' | 'medium' | 'low';
  encoding: 'VP8' | 'H264';
}

@Injectable()
export class VideoGenerationService {
  private readonly logger = new Logger(VideoGenerationService.name);

  resolveVideoConfig(
    _sessionConfig: JsonRecord,
    _personaTraits: JsonRecord | null,
  ): ResolvedVideoConfig {
    // Avatar providers are intentionally disabled while a custom microservice is integrated.
    return { mode: 'rendered' };
  }

  queueAssistantVideo(_input: QueueAssistantVideoInput): Promise<void> {
    // No-op: provider-based avatar generation has been removed.
    return Promise.resolve();
  }

  createLiveAvatarSessionToken(
    _sessionId: string,
  ): Promise<LiveAvatarSessionTokenResult> {
    return Promise.reject(
      new ServiceUnavailableException(
        'Realtime avatar integration is disabled on this backend.',
      ),
    );
  }

  getVideoAudioAsset(
    _jobId: string,
    _token: string,
  ): Promise<TurnAudioResult | null> {
    return Promise.resolve(null);
  }

  getVideoStreamResponse(
    _sessionId: string,
    _token: string,
    _rangeHeader?: string,
  ): Promise<Response | null> {
    return Promise.resolve(null);
  }

  handleHeyGenCallback(_payload: unknown): Promise<void> {
    this.logger.debug(
      'Ignoring HeyGen webhook payload because integration is disabled.',
    );
    return Promise.resolve();
  }
}
