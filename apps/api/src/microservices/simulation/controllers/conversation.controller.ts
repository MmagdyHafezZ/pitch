import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { WsEnvelope, ConversationStartPayload } from '../dto/websocket.dto';
import { LLMRouterService } from '../services/llm/llm-router.service';
import { TtsService } from '../tts/tts.service';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';

@Controller()
export class ConversationController {
  private readonly logger = new Logger(ConversationController.name);

  constructor(
    private readonly llmRouter: LLMRouterService,
    private readonly ttsService: TtsService,
    private readonly prisma: SimulationPrismaService,
  ) {}

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.CONVERSATION_PROCESS)
  async processConversation(
    @Payload() envelope: WsEnvelope<ConversationStartPayload>,
  ) {
    try {
      this.logger.log(
        `Processing conversation for session ${envelope.sessionId}`,
      );

      const payload = envelope.payload;

      let personaData: { id: string; name: string; traits: any } | null = null;
      let ttsProvider = 'elevenlabs';
      let ttsVoice: string | undefined = undefined;

      if (payload.personaId) {
        personaData = await this.prisma.client.persona.findUnique({
          where: { id: payload.personaId },
        });

        if (personaData && personaData.traits) {
          const traits = personaData.traits as Record<string, any>;
          if (
            typeof traits === 'object' &&
            traits !== null &&
            'voice' in traits &&
            typeof traits.voice === 'object' &&
            traits.voice !== null
          ) {
            const voice = traits.voice as Record<string, any>;
            if (typeof voice.provider === 'string') {
              ttsProvider = voice.provider;
            }
            if (typeof voice.voiceName === 'string') {
              ttsVoice = voice.voiceName;
            }
          }
        }
      }

      if (payload.ttsConfig?.provider) {
        ttsProvider = payload.ttsConfig.provider;
      }
      if (payload.ttsConfig?.voice) {
        ttsVoice = payload.ttsConfig.voice;
      }

      const messages = [...(payload.messages || [])];

      if (messages.length === 0) {
        messages.push({
          role: 'user' as const,
          content: payload.text,
        });
      }

      if (personaData) {
        const traits = personaData.traits as Record<string, any>;
        const systemMessage = {
          role: 'system' as const,
          content: `You are ${personaData.name}. ${typeof traits === 'object' && traits !== null ? JSON.stringify(traits) : ''}`,
        };
        messages.unshift(systemMessage);
      }

      const llmConfig = payload.config || {
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 500,
      };

      const llmResponse = await this.llmRouter.complete({
        sessionId: envelope.sessionId,
        messages,
        config: llmConfig,
      });

      const responseText = llmResponse.response.content || '';

      if (!responseText.trim()) {
        throw new Error('LLM returned empty response');
      }

      let audioBase64: string | undefined;
      let contentType: string | undefined;

      try {
        const ttsResult = await this.ttsService.synthesize(
          responseText,
          ttsProvider,
          ttsVoice ? { voice: ttsVoice } : undefined,
        );
        audioBase64 = ttsResult.audioBuffer.toString('base64');
        contentType = ttsResult.contentType;
      } catch (ttsError) {
        this.logger.warn(
          'TTS generation failed, returning text only',
          ttsError,
        );
      }

      return {
        text: responseText,
        usage: llmResponse.response.usage,
        audioBase64,
        contentType,
      };
    } catch (error) {
      this.logger.error('Conversation processing failed', error);
      throw toRpcException(error);
    }
  }
}
