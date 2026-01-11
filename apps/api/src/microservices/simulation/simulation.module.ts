import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatController } from './controllers/chat.controller';
import { SimulationPrismaService } from './prisma/simulation-prisma.service';
import { MongoConnectionService } from './services/mongo/mongo-connection.service';
import { LLMService } from './services/llm/llm.service';
import { UsageCalculatorService } from './services/llm/usage-calculator.service';
import { ModelCapabilitiesRegistry } from './services/llm/model-capabilities.registry';
import { LLMProviderRegistry } from './providers/llm/llm-provider.registry';
import { OpenAIProvider } from './providers/llm/openai.provider';
import { WatsonxProvider } from './providers/llm/watsonx.provider';
import { TTSProviderRegistry } from './providers/tts/tts-provider.registry';
import { ElevenLabsProvider } from './providers/tts/elevenlabs.provider';
import { TTSService } from './services/tts/tts.service';
import { STTProviderRegistry } from './providers/stt/stt-provider.registry';
import { STTService } from './services/stt/stt.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [ChatController],
  providers: [
    SimulationPrismaService,
    MongoConnectionService,
    LLMProviderRegistry,
    ModelCapabilitiesRegistry,
    UsageCalculatorService,
    LLMService,
    OpenAIProvider,
    WatsonxProvider,
    {
      provide: 'LLM_PROVIDER_BOOTSTRAP',
      useFactory: (
        registry: LLMProviderRegistry,
        openai: OpenAIProvider,
        watsonx: WatsonxProvider,
      ) => {
        registry.register(openai);
        registry.register(watsonx);
        return true;
      },
      inject: [LLMProviderRegistry, OpenAIProvider, WatsonxProvider],
    },
    TTSProviderRegistry,
    ElevenLabsProvider,
    TTSService,
    {
      provide: 'TTS_PROVIDER_BOOTSTRAP',
      useFactory: (
        registry: TTSProviderRegistry,
        elevenlabs: ElevenLabsProvider,
      ) => {
        registry.register(elevenlabs);
        return true;
      },
      inject: [TTSProviderRegistry, ElevenLabsProvider],
    },
    STTProviderRegistry,
    STTService,
  ],
  exports: [LLMService, TTSService, STTService],
})
export class SimulationModule {}
