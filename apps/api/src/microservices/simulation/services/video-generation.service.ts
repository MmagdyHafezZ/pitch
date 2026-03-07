import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/simulation-client';
import { randomUUID } from 'crypto';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';
import { TtsService } from '../tts/tts.service';
import { SimulationRedisService } from './redis/redis.service';
import { PersonaMediaService } from './persona-media.service';

type JsonRecord = Record<string, unknown>;
type VideoProvider = 'heygen' | 'azure-avatar';
type VideoMode = 'rendered' | 'realtime';
type VideoRuntimeStatus = 'idle' | 'queued' | 'rendering' | 'ready' | 'failed';
type LiveAvatarVideoQuality = 'very_high' | 'high' | 'medium' | 'low';
type LiveAvatarVideoEncoding = 'VP8' | 'H264';

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

interface VideoSessionRuntime extends JsonRecord {
  status?: VideoRuntimeStatus;
  provider?: VideoProvider;
  fallbackProvider?: VideoProvider;
  activeJobId?: string;
  playbackToken?: string;
  requestId?: string;
  providerJobId?: string;
  assetUrl?: string;
  lastError?: string;
  submittedAt?: string;
  completedAt?: string;
  updatedAt?: string;
  textPreview?: string;
  fallbackUsed?: boolean;
}

interface ResolvedVideoConfig {
  mode: VideoMode;
  provider: VideoProvider;
  fallbackProvider?: VideoProvider;
  heygenAvatarId?: string;
  heygenAvatarStyle?: string;
  heygenBackgroundColor?: string;
  heygenWidth: number;
  heygenHeight: number;
  liveAvatarId?: string;
  liveAvatarName?: string;
  liveAvatarQuality: LiveAvatarVideoQuality;
  liveAvatarEncoding: LiveAvatarVideoEncoding;
  azureAvatarCharacter?: string;
  azureAvatarStyle?: string;
  azureVoice?: string;
  azureBackgroundColor?: string;
}

interface LiveAvatarCatalogAvatar {
  id: string;
  name: string;
  previewUrl?: string | null;
  defaultVoice?: {
    id: string;
    name: string;
  } | null;
}

export interface LiveAvatarSessionTokenResult {
  sessionId: string;
  sessionToken: string;
  avatarId: string;
  avatarName: string;
  previewUrl?: string | null;
  mode: 'LITE';
  quality: LiveAvatarVideoQuality;
  encoding: LiveAvatarVideoEncoding;
}

interface HeyGenCreateResult {
  providerJobId: string;
}

interface AzureCreateResult {
  providerJobId: string;
}

interface AzureStatusResult {
  status: string;
  assetUrl?: string;
  error?: string;
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toRecord = (value: unknown): JsonRecord => (isRecord(value) ? value : {});

const pickString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const toFiniteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const normalizeVideoProvider = (
  value: string | undefined,
): VideoProvider | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'heygen') return 'heygen';
  if (normalized === 'azure' || normalized === 'azure-avatar') {
    return 'azure-avatar';
  }
  return undefined;
};

const normalizeVideoMode = (
  value: string | undefined,
): VideoMode | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'rendered') return 'rendered';
  if (
    normalized === 'realtime' ||
    normalized === 'liveavatar' ||
    normalized === 'live-avatar'
  ) {
    return 'realtime';
  }
  return undefined;
};

const normalizeLiveAvatarQuality = (
  value: string | undefined,
): LiveAvatarVideoQuality | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'very_high' ||
    normalized === 'high' ||
    normalized === 'medium' ||
    normalized === 'low'
  ) {
    return normalized;
  }
  return undefined;
};

const normalizeLiveAvatarEncoding = (
  value: string | undefined,
): LiveAvatarVideoEncoding | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  if (normalized === 'VP8' || normalized === 'H264') {
    return normalized;
  }
  return undefined;
};

const isUuid = (value: string | undefined): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

const normalizeAvatarName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const AVATAR_MATCH_STOPWORDS = new Set([
  'public',
  'front',
  'side',
  'sitting',
  'standing',
  'business',
  'office',
  'training',
  'biztalk',
  'talk',
]);

const tokenizeAvatarName = (value: string): string[] =>
  normalizeAvatarName(value)
    .split(' ')
    .filter((token) => token.length > 1 && !AVATAR_MATCH_STOPWORDS.has(token));

const stripUndefined = <T extends JsonRecord>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

@Injectable()
export class VideoGenerationService {
  private readonly logger = new Logger(VideoGenerationService.name);
  private readonly heygenApiBase = 'https://api.heygen.com';
  private readonly liveAvatarApiBase = 'https://api.liveavatar.com';
  private liveAvatarCatalogCache: {
    expiresAt: number;
    avatars: LiveAvatarCatalogAvatar[];
  } | null = null;

  constructor(
    private readonly prisma: SimulationPrismaService,
    private readonly ttsService: TtsService,
    private readonly redis: SimulationRedisService,
    private readonly configService: ConfigService,
    private readonly personaMediaService: PersonaMediaService,
  ) {}

  async queueAssistantVideo(input: QueueAssistantVideoInput): Promise<void> {
    const text = input.text.trim();
    if (!text) return;

    const session = await this.prisma.client.session.findUnique({
      where: { id: input.sessionId },
      include: { persona: true },
    });

    if (!session || session.type !== 'video') {
      return;
    }

    const sessionConfig = toRecord(session.sessionConfig);
    const personaTraits = session.persona
      ? this.personaMediaService.enrichTraits({
          personaId: session.persona.id,
          name: session.persona.name,
          traits: session.persona.traits,
        })
      : null;
    const videoConfig = this.resolveVideoConfig(sessionConfig, personaTraits);
    if (videoConfig.mode !== 'rendered') {
      return;
    }
    const jobId = randomUUID();
    const now = new Date().toISOString();
    const playbackToken = randomUUID();

    await this.upsertVideoRuntime(session.id, {
      provider: videoConfig.provider,
      fallbackProvider: videoConfig.fallbackProvider,
      status: 'queued',
      activeJobId: jobId,
      playbackToken,
      requestId: input.requestId,
      providerJobId: undefined,
      assetUrl: undefined,
      lastError: undefined,
      submittedAt: now,
      completedAt: undefined,
      updatedAt: now,
      textPreview: text.slice(0, 180),
      fallbackUsed: false,
    });

    const baseUrl = this.getPublicApiBaseUrl();

    if (
      videoConfig.provider === 'heygen' &&
      baseUrl &&
      videoConfig.heygenAvatarId &&
      this.configService.get<string>('HEYGEN_API_KEY')
    ) {
      try {
        const audio = await this.synthesizeTurnAudio({
          text,
          provider: input.ttsProvider,
          voice: input.ttsVoice,
          language: input.language,
          model: input.ttsModel,
        });
        const token = randomUUID();
        await this.redis.setVideoAudioAsset(jobId, {
          sessionId: session.id,
          token,
          contentType: audio.contentType,
          audioBase64: audio.audioBuffer.toString('base64'),
          createdAt: now,
        });
        await this.redis.setVideoJob(jobId, {
          jobId,
          sessionId: session.id,
          requestId: input.requestId,
          provider: 'heygen',
          text,
          language: input.language,
          fallbackAttempted: false,
          createdAt: now,
        });

        const result = await this.createHeyGenVideo({
          jobId,
          audioUrl: this.buildVideoAudioUrl(baseUrl, jobId, token),
          callbackUrl: this.buildHeyGenCallbackUrl(baseUrl),
          config: videoConfig,
        });

        if (!(await this.isActiveJob(session.id, jobId))) {
          await this.cleanupJobArtifacts(jobId);
          return;
        }

        await this.upsertVideoRuntime(session.id, {
          provider: 'heygen',
          fallbackProvider: videoConfig.fallbackProvider,
          status: 'rendering',
          activeJobId: jobId,
          requestId: input.requestId,
          providerJobId: result.providerJobId,
          updatedAt: new Date().toISOString(),
        });
        return;
      } catch (error) {
        this.logger.warn(
          `HeyGen request failed for session ${session.id}: ${
            (error as Error)?.message ?? error
          }`,
        );
      }
    }

    await this.beginAzureFallback({
      sessionId: session.id,
      jobId,
      requestId: input.requestId,
      text,
      language: input.language,
      config: videoConfig,
      reason:
        videoConfig.provider === 'heygen'
          ? 'HeyGen unavailable. Falling back to Azure avatar.'
          : 'Using Azure avatar for video generation.',
    });
  }

  async createLiveAvatarSessionToken(
    sessionId: string,
  ): Promise<LiveAvatarSessionTokenResult> {
    const apiKey = this.getLiveAvatarApiKey();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'LiveAvatar is not configured. Set LIVEAVATAR_API_KEY or HEYGEN_API_KEY.',
      );
    }

    const session = await this.prisma.client.session.findUnique({
      where: { id: sessionId },
      include: { persona: true },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.type !== 'video') {
      throw new BadRequestException(
        'Realtime avatar is only available for video sessions.',
      );
    }

    const sessionConfig = toRecord(session.sessionConfig);
    const personaTraits = session.persona
      ? this.personaMediaService.enrichTraits({
          personaId: session.persona.id,
          name: session.persona.name,
          traits: session.persona.traits,
        })
      : null;
    const videoConfig = this.resolveVideoConfig(sessionConfig, personaTraits);

    if (videoConfig.mode !== 'realtime') {
      throw new BadRequestException(
        'Realtime avatar is not enabled for this session.',
      );
    }

    const avatar = await this.resolveLiveAvatarCatalogEntry({
      sessionConfig,
      personaTraits,
      personaName: session.persona?.name,
      videoConfig,
    });

    const response = await fetch(
      `${this.liveAvatarApiBase}/v1/sessions/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey,
        },
        body: JSON.stringify(
          stripUndefined({
            mode: 'LITE',
            avatar_id: avatar.id,
            is_sandbox: this.isLiveAvatarSandboxEnabled(sessionConfig),
            interactivity_type: 'PUSH_TO_TALK',
            max_session_duration:
              this.resolveLiveAvatarMaxSessionDuration(sessionConfig),
            video_settings: stripUndefined({
              quality: videoConfig.liveAvatarQuality,
              encoding: videoConfig.liveAvatarEncoding,
            }),
          }),
        ),
      },
    );

    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!response.ok || Number(payload.code ?? 100) !== 100) {
      throw new ServiceUnavailableException(
        pickString(payload.message) ??
          `LiveAvatar session token request failed with ${response.status}.`,
      );
    }

    const data = toRecord(payload.data);
    const vendorSessionId = pickString(data.session_id);
    const sessionToken = pickString(data.session_token);

    if (!vendorSessionId || !sessionToken) {
      throw new ServiceUnavailableException(
        'LiveAvatar did not return a session token.',
      );
    }

    return {
      sessionId: vendorSessionId,
      sessionToken,
      avatarId: avatar.id,
      avatarName: avatar.name,
      previewUrl: avatar.previewUrl ?? null,
      mode: 'LITE',
      quality: videoConfig.liveAvatarQuality,
      encoding: videoConfig.liveAvatarEncoding,
    };
  }

  async getVideoAudioAsset(
    jobId: string,
    token: string,
  ): Promise<TurnAudioResult | null> {
    const asset = await this.redis.getVideoAudioAsset(jobId);
    if (!asset || asset.token !== token) {
      return null;
    }

    return {
      audioBuffer: Buffer.from(asset.audioBase64, 'base64'),
      contentType: asset.contentType,
    };
  }

  async getVideoStreamResponse(
    sessionId: string,
    token: string,
    rangeHeader?: string,
  ): Promise<Response | null> {
    const session = await this.prisma.client.session.findUnique({
      where: { id: sessionId },
      select: { sessionConfig: true },
    });
    if (!session) {
      return null;
    }

    const runtime = this.getVideoRuntime(toRecord(session.sessionConfig));
    if (
      runtime.status !== 'ready' ||
      !runtime.assetUrl ||
      !runtime.playbackToken ||
      runtime.playbackToken !== token
    ) {
      return null;
    }

    const headers: Record<string, string> = {
      Accept: 'video/mp4,*/*',
    };
    if (rangeHeader) {
      headers.Range = rangeHeader;
    }

    const response = await fetch(runtime.assetUrl, {
      headers,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(
        `Unable to fetch rendered video asset (${response.status})`,
      );
    }

    return response;
  }

  async handleHeyGenCallback(payload: unknown): Promise<void> {
    const callback = this.parseHeyGenCallback(payload);
    if (!callback.jobId) {
      this.logger.warn('Ignoring HeyGen callback without callback_id');
      return;
    }

    const job = await this.redis.getVideoJob(callback.jobId);
    if (!job) {
      this.logger.warn(
        `Ignoring unknown HeyGen callback job ${callback.jobId}`,
      );
      return;
    }

    const session = await this.prisma.client.session.findUnique({
      where: { id: job.sessionId },
      include: { persona: true },
    });
    if (!session) {
      await this.cleanupJobArtifacts(callback.jobId);
      return;
    }

    const runtime = this.getVideoRuntime(toRecord(session.sessionConfig));
    if (runtime.activeJobId !== callback.jobId) {
      this.logger.debug(
        `Ignoring stale HeyGen callback for job ${callback.jobId} on session ${job.sessionId}`,
      );
      await this.cleanupJobArtifacts(callback.jobId);
      return;
    }

    if (callback.status === 'ready' && callback.assetUrl) {
      await this.upsertVideoRuntime(session.id, {
        provider: 'heygen',
        status: 'ready',
        activeJobId: callback.jobId,
        providerJobId: callback.providerJobId ?? runtime.providerJobId,
        assetUrl: callback.assetUrl,
        lastError: undefined,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await this.cleanupJobArtifacts(callback.jobId);
      return;
    }

    await this.beginAzureFallback({
      sessionId: session.id,
      jobId: callback.jobId,
      requestId: job.requestId,
      text: job.text,
      language: job.language,
      config: this.resolveVideoConfig(
        toRecord(session.sessionConfig),
        session.persona
          ? this.personaMediaService.enrichTraits({
              personaId: session.persona.id,
              name: session.persona.name,
              traits: session.persona.traits,
            })
          : null,
      ),
      reason:
        callback.error ??
        'HeyGen avatar rendering failed. Falling back to Azure avatar.',
    });
  }

  private async synthesizeTurnAudio(input: {
    text: string;
    provider: string;
    voice?: string;
    language?: string;
    model?: string;
  }): Promise<TurnAudioResult> {
    const options = input.voice
      ? {
          voice: input.voice,
          language: input.language,
          model: input.model,
        }
      : {
          language: input.language,
          model: input.model,
        };

    try {
      const result = await this.ttsService.synthesize(
        input.text,
        input.provider,
        options,
      );
      return {
        audioBuffer: result.audioBuffer,
        contentType: result.contentType,
      };
    } catch (error) {
      if (input.provider !== 'melotts') {
        const fallback = await this.ttsService.synthesize(
          input.text,
          'melotts',
          {
            language: input.language,
          },
        );
        return {
          audioBuffer: fallback.audioBuffer,
          contentType: fallback.contentType,
        };
      }
      throw error;
    }
  }

  resolveVideoConfig(
    sessionConfig: JsonRecord,
    personaTraits?: JsonRecord | null,
  ): ResolvedVideoConfig {
    const video = toRecord(sessionConfig.video);
    const heygen = toRecord(video.heygen);
    const azure = toRecord(video.azure);
    const avatar = toRecord(personaTraits?.avatar);

    return {
      mode: normalizeVideoMode(pickString(video.mode)) ?? 'rendered',
      provider: normalizeVideoProvider(pickString(video.provider)) ?? 'heygen',
      fallbackProvider:
        normalizeVideoProvider(pickString(video.fallbackProvider)) ??
        'azure-avatar',
      heygenAvatarId: pickString(
        heygen.avatarId,
        video.heygenAvatarId,
        avatar.heygenAvatarId,
        avatar.avatarId,
        this.configService.get<string>('HEYGEN_DEFAULT_AVATAR_ID'),
      ),
      heygenAvatarStyle:
        pickString(
          heygen.avatarStyle,
          video.heygenAvatarStyle,
          avatar.avatarStyle,
          this.configService.get<string>('HEYGEN_DEFAULT_AVATAR_STYLE'),
        ) ?? 'normal',
      heygenBackgroundColor: pickString(
        heygen.backgroundColor,
        video.heygenBackgroundColor,
        avatar.backgroundColor,
        this.configService.get<string>('HEYGEN_DEFAULT_BACKGROUND_COLOR'),
      ),
      heygenWidth:
        toFiniteNumber(heygen.width) ??
        toFiniteNumber(video.heygenWidth) ??
        Number(this.configService.get<string>('HEYGEN_DEFAULT_WIDTH') ?? 720),
      heygenHeight:
        toFiniteNumber(heygen.height) ??
        toFiniteNumber(video.heygenHeight) ??
        Number(this.configService.get<string>('HEYGEN_DEFAULT_HEIGHT') ?? 720),
      liveAvatarId: pickString(
        video.liveAvatarId,
        avatar.liveAvatarId,
        this.configService.get<string>('HEYGEN_LIVE_DEFAULT_AVATAR_ID'),
      ),
      liveAvatarName: pickString(
        video.liveAvatarName,
        avatar.liveAvatarName,
        avatar.label,
        avatar.heygenAvatarId,
      ),
      liveAvatarQuality:
        normalizeLiveAvatarQuality(
          pickString(
            video.liveAvatarQuality,
            this.configService.get<string>('HEYGEN_LIVE_VIDEO_QUALITY'),
          ),
        ) ?? 'low',
      liveAvatarEncoding:
        normalizeLiveAvatarEncoding(
          pickString(
            video.liveAvatarEncoding,
            this.configService.get<string>('HEYGEN_LIVE_VIDEO_ENCODING'),
          ),
        ) ?? 'H264',
      azureAvatarCharacter: pickString(
        azure.avatarCharacter,
        azure.talkingAvatarCharacter,
        video.azureAvatarCharacter,
        this.configService.get<string>('AZURE_AVATAR_CHARACTER'),
      ),
      azureAvatarStyle: pickString(
        azure.avatarStyle,
        azure.talkingAvatarStyle,
        video.azureAvatarStyle,
        this.configService.get<string>('AZURE_AVATAR_STYLE'),
      ),
      azureVoice: pickString(
        azure.voice,
        video.azureVoice,
        this.configService.get<string>('AZURE_AVATAR_VOICE'),
      ),
      azureBackgroundColor: pickString(
        azure.backgroundColor,
        video.azureBackgroundColor,
        this.configService.get<string>('AZURE_AVATAR_BACKGROUND_COLOR'),
      ),
    };
  }

  private async beginAzureFallback(input: {
    sessionId: string;
    jobId: string;
    requestId: string;
    text: string;
    language?: string;
    config: ResolvedVideoConfig;
    reason: string;
  }): Promise<void> {
    if (!(await this.isActiveJob(input.sessionId, input.jobId))) {
      await this.cleanupJobArtifacts(input.jobId);
      return;
    }

    const speechKey = this.configService.get<string>('AZURE_SPEECH_KEY');
    const speechRegion = this.configService.get<string>('AZURE_SPEECH_REGION');
    const character = input.config.azureAvatarCharacter;
    const style = input.config.azureAvatarStyle;
    const voice = input.config.azureVoice;

    if (!speechKey || !speechRegion || !character || !style || !voice) {
      await this.upsertVideoRuntime(input.sessionId, {
        provider: 'azure-avatar',
        status: 'failed',
        activeJobId: input.jobId,
        requestId: input.requestId,
        lastError:
          'Video generation is unavailable. Configure HeyGen and Azure avatar credentials.',
        updatedAt: new Date().toISOString(),
        fallbackUsed: true,
      });
      await this.cleanupJobArtifacts(input.jobId);
      return;
    }

    const providerJobId = `azure-${input.jobId}`;
    await this.redis.setVideoJob(input.jobId, {
      jobId: input.jobId,
      sessionId: input.sessionId,
      requestId: input.requestId,
      provider: 'azure-avatar',
      text: input.text,
      language: input.language,
      fallbackAttempted: true,
      createdAt: new Date().toISOString(),
    });

    try {
      const result = await this.createAzureAvatarVideo({
        providerJobId,
        text: input.text,
        language: input.language,
        config: input.config,
      });

      await this.upsertVideoRuntime(input.sessionId, {
        provider: 'azure-avatar',
        fallbackProvider: input.config.fallbackProvider,
        status: 'rendering',
        activeJobId: input.jobId,
        requestId: input.requestId,
        providerJobId: result.providerJobId,
        lastError: input.reason,
        updatedAt: new Date().toISOString(),
        fallbackUsed: true,
      });

      void this.monitorAzureJob({
        sessionId: input.sessionId,
        activeJobId: input.jobId,
        providerJobId: result.providerJobId,
      });
    } catch (error) {
      await this.upsertVideoRuntime(input.sessionId, {
        provider: 'azure-avatar',
        status: 'failed',
        activeJobId: input.jobId,
        requestId: input.requestId,
        providerJobId,
        lastError:
          (error as Error)?.message ?? 'Azure avatar fallback failed to start.',
        updatedAt: new Date().toISOString(),
        fallbackUsed: true,
      });
      await this.cleanupJobArtifacts(input.jobId);
    }
  }

  private async monitorAzureJob(input: {
    sessionId: string;
    activeJobId: string;
    providerJobId: string;
  }): Promise<void> {
    for (let attempt = 0; attempt < 48; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      try {
        const status = await this.getAzureAvatarStatus(input.providerJobId);
        const session = await this.prisma.client.session.findUnique({
          where: { id: input.sessionId },
        });

        if (!session) {
          await this.cleanupJobArtifacts(input.activeJobId);
          return;
        }

        const runtime = this.getVideoRuntime(toRecord(session.sessionConfig));
        if (runtime.activeJobId !== input.activeJobId) {
          await this.cleanupJobArtifacts(input.activeJobId);
          return;
        }

        const normalizedStatus = status.status.trim().toLowerCase();
        if (
          normalizedStatus === 'succeeded' ||
          normalizedStatus === 'success' ||
          normalizedStatus === 'completed'
        ) {
          if (!status.assetUrl) {
            throw new Error('Azure avatar completed without a result URL');
          }

          await this.upsertVideoRuntime(input.sessionId, {
            provider: 'azure-avatar',
            status: 'ready',
            activeJobId: input.activeJobId,
            providerJobId: input.providerJobId,
            assetUrl: status.assetUrl,
            lastError: undefined,
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            fallbackUsed: true,
          });
          await this.cleanupJobArtifacts(input.activeJobId);
          return;
        }

        if (
          normalizedStatus === 'failed' ||
          normalizedStatus === 'error' ||
          normalizedStatus === 'cancelled'
        ) {
          await this.upsertVideoRuntime(input.sessionId, {
            provider: 'azure-avatar',
            status: 'failed',
            activeJobId: input.activeJobId,
            providerJobId: input.providerJobId,
            lastError:
              status.error ?? 'Azure avatar rendering failed to complete.',
            updatedAt: new Date().toISOString(),
            fallbackUsed: true,
          });
          await this.cleanupJobArtifacts(input.activeJobId);
          return;
        }
      } catch (error) {
        this.logger.warn(
          `Azure avatar poll failed for ${input.providerJobId}: ${
            (error as Error)?.message ?? error
          }`,
        );
      }
    }

    await this.upsertVideoRuntime(input.sessionId, {
      provider: 'azure-avatar',
      status: 'failed',
      activeJobId: input.activeJobId,
      providerJobId: input.providerJobId,
      lastError: 'Azure avatar rendering timed out.',
      updatedAt: new Date().toISOString(),
      fallbackUsed: true,
    });
    await this.cleanupJobArtifacts(input.activeJobId);
  }

  private async createHeyGenVideo(input: {
    jobId: string;
    audioUrl: string;
    callbackUrl: string;
    config: ResolvedVideoConfig;
  }): Promise<HeyGenCreateResult> {
    const apiKey = this.configService.get<string>('HEYGEN_API_KEY');
    if (!apiKey) {
      throw new Error('HEYGEN_API_KEY is not configured');
    }
    if (!input.config.heygenAvatarId) {
      throw new Error('HeyGen avatar ID is not configured');
    }

    const videoInput: Record<string, unknown> = {
      character: stripUndefined({
        type: 'avatar',
        avatar_id: input.config.heygenAvatarId,
        avatar_style: input.config.heygenAvatarStyle,
      }),
      voice: {
        type: 'audio',
        audio_url: input.audioUrl,
      },
    };

    if (input.config.heygenBackgroundColor) {
      videoInput.background = {
        type: 'color',
        value: input.config.heygenBackgroundColor,
      };
    }

    const response = await fetch(`${this.heygenApiBase}/v2/video/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        video_inputs: [videoInput],
        dimension: {
          width: input.config.heygenWidth,
          height: input.config.heygenHeight,
        },
        callback_id: input.jobId,
        callback_url: input.callbackUrl,
      }),
      signal: AbortSignal.timeout(20000),
    });

    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!response.ok) {
      throw new Error(
        pickString(
          payload.error,
          payload.message,
          payload.error_message,
          `HeyGen request failed with ${response.status}`,
        ) ?? 'HeyGen request failed',
      );
    }

    const data = toRecord(payload.data);
    const providerJobId = pickString(
      data.video_id,
      data.videoId,
      payload.video_id,
      payload.videoId,
    );

    if (!providerJobId) {
      throw new Error('HeyGen did not return a video ID');
    }

    return { providerJobId };
  }

  private async createAzureAvatarVideo(input: {
    providerJobId: string;
    text: string;
    language?: string;
    config: ResolvedVideoConfig;
  }): Promise<AzureCreateResult> {
    const speechKey = this.configService.get<string>('AZURE_SPEECH_KEY');
    const speechRegion = this.configService.get<string>('AZURE_SPEECH_REGION');
    if (!speechKey || !speechRegion) {
      throw new Error('Azure Speech credentials are not configured');
    }

    const url = this.buildAzureBatchUrl(speechRegion, input.providerJobId);
    const voice = input.config.azureVoice;
    const character = input.config.azureAvatarCharacter;
    const style = input.config.azureAvatarStyle;

    if (!voice || !character || !style) {
      throw new Error(
        'Azure avatar voice and character configuration is missing',
      );
    }

    const lang = pickString(input.language, 'en-US') ?? 'en-US';
    const ssml = `<speak version="1.0" xml:lang="${escapeXml(lang)}"><voice name="${escapeXml(voice)}">${escapeXml(
      input.text,
    )}</voice></speak>`;
    const avatarConfig = stripUndefined({
      customized: false,
      talkingAvatarCharacter: character,
      talkingAvatarStyle: style,
      backgroundColor: input.config.azureBackgroundColor,
    });

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': speechKey,
      },
      body: JSON.stringify({
        inputKind: 'SSML',
        inputs: [{ content: ssml }],
        avatarConfig,
      }),
      signal: AbortSignal.timeout(20000),
    });

    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!response.ok) {
      throw new Error(
        pickString(
          payload.error,
          payload.message,
          payload.error_message,
          `Azure avatar request failed with ${response.status}`,
        ) ?? 'Azure avatar request failed',
      );
    }

    return { providerJobId: input.providerJobId };
  }

  private async getAzureAvatarStatus(
    providerJobId: string,
  ): Promise<AzureStatusResult> {
    const speechKey = this.configService.get<string>('AZURE_SPEECH_KEY');
    const speechRegion = this.configService.get<string>('AZURE_SPEECH_REGION');
    if (!speechKey || !speechRegion) {
      throw new Error('Azure Speech credentials are not configured');
    }

    const response = await fetch(
      this.buildAzureBatchUrl(speechRegion, providerJobId),
      {
        headers: {
          'Ocp-Apim-Subscription-Key': speechKey,
        },
        signal: AbortSignal.timeout(10000),
      },
    );

    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!response.ok) {
      throw new Error(
        pickString(
          payload.error,
          payload.message,
          `Azure avatar status failed with ${response.status}`,
        ) ?? 'Azure avatar status failed',
      );
    }

    const status = pickString(
      payload.status,
      toRecord(payload.properties).status,
    );
    if (!status) {
      throw new Error('Azure avatar status response did not include a status');
    }

    return {
      status,
      assetUrl: this.extractAzureAssetUrl(payload),
      error: pickString(
        payload.error,
        payload.message,
        toRecord(payload.properties).error,
      ),
    };
  }

  private parseHeyGenCallback(payload: unknown): {
    jobId?: string;
    providerJobId?: string;
    assetUrl?: string;
    status: 'ready' | 'failed';
    error?: string;
  } {
    const root = toRecord(payload);
    const data = toRecord(root.data);
    const eventData = toRecord(root.event_data);
    const merged = {
      ...root,
      ...data,
      ...eventData,
    };

    const eventType = pickString(
      root.event_type,
      root.eventType,
      root.type,
      merged.status,
    )?.toLowerCase();

    const assetUrl = pickString(
      merged.url,
      merged.video_url,
      merged.videoUrl,
      toRecord(merged.video).url,
      toRecord(merged.outputs).resultUrl,
    );

    const providerJobId = pickString(
      merged.video_id,
      merged.videoId,
      root.video_id,
      root.videoId,
    );

    const jobId = pickString(
      merged.callback_id,
      merged.callbackId,
      root.callback_id,
      root.callbackId,
    );

    const failed =
      eventType?.includes('fail') === true ||
      eventType?.includes('error') === true ||
      (!assetUrl && ['failed', 'error', 'cancelled'].includes(eventType ?? ''));

    return {
      jobId,
      providerJobId,
      assetUrl,
      status: failed ? 'failed' : 'ready',
      error: pickString(merged.error, merged.message, root.error, root.message),
    };
  }

  private async upsertVideoRuntime(
    sessionId: string,
    patch: Partial<VideoSessionRuntime>,
  ): Promise<void> {
    const session = await this.prisma.client.session.findUnique({
      where: { id: sessionId },
      select: { sessionConfig: true },
    });
    if (!session) {
      return;
    }

    const sessionConfig = toRecord(session.sessionConfig);
    const currentVideo = toRecord(sessionConfig.video);
    const currentRuntime = toRecord(currentVideo.runtime);

    const nextRuntime = stripUndefined({
      ...currentRuntime,
      ...patch,
    }) as JsonRecord;
    const nextVideo = stripUndefined({
      ...currentVideo,
      provider: pickString(patch.provider, currentVideo.provider),
      fallbackProvider: pickString(
        patch.fallbackProvider,
        currentVideo.fallbackProvider,
      ),
      runtime: nextRuntime,
    });

    await this.prisma.client.session.update({
      where: { id: sessionId },
      data: {
        sessionConfig: {
          ...sessionConfig,
          video: nextVideo,
        } as Prisma.InputJsonValue,
      },
    });
    await this.redis.deleteSessionFull(sessionId).catch(() => {});
  }

  private getVideoRuntime(sessionConfig: JsonRecord): VideoSessionRuntime {
    return toRecord(
      toRecord(sessionConfig.video).runtime,
    ) as VideoSessionRuntime;
  }

  private extractAzureAssetUrl(
    payload: Record<string, unknown>,
  ): string | undefined {
    const outputs = toRecord(payload.outputs);
    const properties = toRecord(payload.properties);
    const outputFiles = Array.isArray(outputs.outputFiles)
      ? outputs.outputFiles
      : Array.isArray(properties.outputFiles)
        ? properties.outputFiles
        : [];

    for (const entry of outputFiles) {
      const record = toRecord(entry);
      const candidate = pickString(
        record.url,
        record.resultUrl,
        record.outputUrl,
        record.videoUrl,
      );
      if (candidate) return candidate;
    }

    return pickString(
      outputs.resultUrl,
      outputs.url,
      outputs.videoUrl,
      properties.resultUrl,
      properties.url,
      properties.videoUrl,
      payload.resultUrl,
      payload.url,
      payload.videoUrl,
    );
  }

  private getPublicApiBaseUrl(): string | null {
    const rawBaseUrl =
      this.configService.get<string>('VIDEO_PUBLIC_BASE_URL') ??
      this.configService.get<string>('API_BASE_URL');

    if (!rawBaseUrl) {
      return null;
    }

    return rawBaseUrl
      .trim()
      .replace(/\/api\/v\d+\/?$/i, '')
      .replace(/\/+$/, '');
  }

  private getLiveAvatarApiKey(): string | null {
    return (
      pickString(
        this.configService.get<string>('LIVEAVATAR_API_KEY'),
        this.configService.get<string>('HEYGEN_API_KEY'),
      ) ?? null
    );
  }

  private isLiveAvatarSandboxEnabled(sessionConfig: JsonRecord): boolean {
    const video = toRecord(sessionConfig.video);
    const explicit = video.liveAvatarSandbox;
    if (typeof explicit === 'boolean') {
      return explicit;
    }

    const envValue = this.configService.get<string>('HEYGEN_LIVE_SANDBOX');
    return envValue === '1' || envValue?.toLowerCase() === 'true';
  }

  private resolveLiveAvatarMaxSessionDuration(
    sessionConfig: JsonRecord,
  ): number | undefined {
    const video = toRecord(sessionConfig.video);
    const explicitSeconds = toFiniteNumber(video.maxSessionDurationSeconds);
    if (explicitSeconds && explicitSeconds > 0) {
      return Math.round(explicitSeconds);
    }

    const minutes =
      toFiniteNumber(video.durationMinutes) ??
      toFiniteNumber(sessionConfig.durationMinutes);

    if (minutes && minutes > 0) {
      return Math.round(minutes * 60);
    }

    return undefined;
  }

  private async resolveLiveAvatarCatalogEntry(input: {
    sessionConfig: JsonRecord;
    personaTraits?: JsonRecord | null;
    personaName?: string | null;
    videoConfig: ResolvedVideoConfig;
  }): Promise<LiveAvatarCatalogAvatar> {
    const video = toRecord(input.sessionConfig.video);
    const avatarTraits = toRecord(input.personaTraits?.avatar);
    const explicitId = input.videoConfig.liveAvatarId;
    const explicitName = pickString(
      input.videoConfig.liveAvatarName,
      avatarTraits.label,
      input.personaName ?? undefined,
    );
    const catalog = await this.listLiveAvatarPublicAvatars();

    if (isUuid(explicitId)) {
      const exactMatch = catalog.find((avatar) => avatar.id === explicitId);
      if (exactMatch) {
        return exactMatch;
      }

      return {
        id: explicitId,
        name: explicitName ?? 'Configured avatar',
        previewUrl: null,
      };
    }

    const targetNames = Array.from(
      new Set(
        [
          pickString(video.liveAvatarName),
          pickString(avatarTraits.liveAvatarName),
          pickString(avatarTraits.label),
          pickString(avatarTraits.heygenAvatarId),
          input.personaName ?? undefined,
        ]
          .filter((value): value is string => Boolean(value))
          .flatMap((value) => {
            const normalized = normalizeAvatarName(value);
            const firstToken = tokenizeAvatarName(value)[0];
            return firstToken && firstToken !== normalized
              ? [value, firstToken]
              : [value];
          }),
      ),
    );

    const match = this.matchLiveAvatarByName(catalog, targetNames);
    if (match) {
      return match;
    }

    if (
      explicitName &&
      isUuid(this.configService.get<string>('HEYGEN_LIVE_DEFAULT_AVATAR_ID'))
    ) {
      return {
        id: this.configService.get<string>('HEYGEN_LIVE_DEFAULT_AVATAR_ID')!,
        name: explicitName,
        previewUrl: null,
      };
    }

    throw new ServiceUnavailableException(
      'Unable to resolve a LiveAvatar avatar for this persona. Set sessionConfig.video.liveAvatarId or HEYGEN_LIVE_DEFAULT_AVATAR_ID.',
    );
  }

  private matchLiveAvatarByName(
    catalog: LiveAvatarCatalogAvatar[],
    targetNames: string[],
  ): LiveAvatarCatalogAvatar | null {
    let bestMatch: LiveAvatarCatalogAvatar | null = null;
    let bestScore = -1;

    for (const avatar of catalog) {
      for (const targetName of targetNames) {
        const score = this.scoreLiveAvatarName(targetName, avatar.name);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = avatar;
        }
      }
    }

    return bestScore >= 40 ? bestMatch : null;
  }

  private scoreLiveAvatarName(
    targetName: string,
    candidateName: string,
  ): number {
    const normalizedTarget = normalizeAvatarName(targetName);
    const normalizedCandidate = normalizeAvatarName(candidateName);
    if (!normalizedTarget || !normalizedCandidate) {
      return 0;
    }

    if (normalizedTarget === normalizedCandidate) {
      return 120;
    }

    const targetTokens = tokenizeAvatarName(targetName);
    const candidateTokens = tokenizeAvatarName(candidateName);
    const targetFirst = targetTokens[0];
    const candidateFirst = candidateTokens[0];
    const overlap = targetTokens.filter((token) =>
      candidateTokens.includes(token),
    ).length;

    let score = overlap * 15;

    if (targetFirst && candidateFirst && targetFirst === candidateFirst) {
      score += 55;
    }

    if (
      normalizedCandidate.includes(normalizedTarget) ||
      normalizedTarget.includes(normalizedCandidate)
    ) {
      score += 35;
    }

    return score;
  }

  private async listLiveAvatarPublicAvatars(): Promise<
    LiveAvatarCatalogAvatar[]
  > {
    if (
      this.liveAvatarCatalogCache &&
      this.liveAvatarCatalogCache.expiresAt > Date.now()
    ) {
      return this.liveAvatarCatalogCache.avatars;
    }

    const apiKey = this.getLiveAvatarApiKey();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'LiveAvatar is not configured. Set LIVEAVATAR_API_KEY or HEYGEN_API_KEY.',
      );
    }

    const avatars: LiveAvatarCatalogAvatar[] = [];
    let page = 1;

    while (page <= 5) {
      const response = await fetch(
        `${this.liveAvatarApiBase}/v1/avatars/public?page=${page}&page_size=100`,
        {
          headers: {
            'X-API-KEY': apiKey,
          },
        },
      );

      const payload = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;

      if (!response.ok || Number(payload.code ?? 100) !== 100) {
        throw new ServiceUnavailableException(
          pickString(payload.message) ??
            `LiveAvatar avatar list request failed with ${response.status}.`,
        );
      }

      const data = toRecord(payload.data);
      const results = Array.isArray(data.results) ? data.results : [];

      for (const entry of results) {
        const avatar = toRecord(entry);
        const id = pickString(avatar.id);
        const name = pickString(avatar.name);
        if (!id || !name) {
          continue;
        }

        const defaultVoice = toRecord(avatar.default_voice);
        avatars.push({
          id,
          name,
          previewUrl: pickString(avatar.preview_url) ?? null,
          defaultVoice: pickString(defaultVoice.id, defaultVoice.name)
            ? {
                id: pickString(defaultVoice.id) ?? '',
                name: pickString(defaultVoice.name) ?? '',
              }
            : null,
        });
      }

      if (!pickString(data.next) || results.length === 0) {
        break;
      }

      page += 1;
    }

    this.liveAvatarCatalogCache = {
      expiresAt: Date.now() + 5 * 60 * 1000,
      avatars,
    };

    return avatars;
  }

  private buildVideoAudioUrl(
    baseUrl: string,
    jobId: string,
    token: string,
  ): string {
    const url = new URL(
      `/api/v1/simulation/video-assets/audio/${jobId}`,
      baseUrl,
    );
    url.searchParams.set('token', token);
    return url.toString();
  }

  private buildHeyGenCallbackUrl(baseUrl: string): string {
    return new URL(
      '/api/v1/simulation/video/webhooks/heygen',
      baseUrl,
    ).toString();
  }

  private buildAzureBatchUrl(region: string, providerJobId: string): string {
    return `https://${region}.api.cognitive.microsoft.com/avatar/batchsyntheses/${encodeURIComponent(
      providerJobId,
    )}?api-version=2024-08-01`;
  }

  private async cleanupJobArtifacts(jobId: string): Promise<void> {
    await Promise.allSettled([
      this.redis.deleteVideoAudioAsset(jobId),
      this.redis.deleteVideoJob(jobId),
    ]);
  }

  private async isActiveJob(
    sessionId: string,
    jobId: string,
  ): Promise<boolean> {
    const session = await this.prisma.client.session.findUnique({
      where: { id: sessionId },
      select: { sessionConfig: true },
    });
    if (!session) {
      return false;
    }

    return (
      this.getVideoRuntime(toRecord(session.sessionConfig)).activeJobId ===
      jobId
    );
  }
}
