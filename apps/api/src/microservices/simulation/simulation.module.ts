import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatController } from './controllers/chat.controller';
import { LLMRoutingController } from './controllers/llm-routing.controller';
import { LLMTestController } from './controllers/llm-test.controller';
import { SimulationPrismaService } from './prisma/simulation-prisma.service';
import { LLMService } from './services/llm/llm.service';
import { UsageCalculatorService } from './services/llm/usage-calculator.service';
import { ModelCapabilitiesRegistry } from './services/llm/model-capabilities.registry';
import { LLMRoutingConfigService } from './services/llm/llm-routing-config.service';
import { LLMRouterService } from './services/llm/llm-router.service';
import { LLMProviderRegistry } from './providers/llm/llm-provider.registry';
import { OpenAIProvider } from './providers/llm/openai.provider';
import { WatsonxProvider } from './providers/llm/watsonx.provider';
import { STTProviderRegistry } from './providers/stt/stt-provider.registry';
import { STTService } from './services/stt/stt.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [ChatController, LLMRoutingController, LLMTestController],
  providers: [
    SimulationPrismaService,
    LLMProviderRegistry,
    ModelCapabilitiesRegistry,
    LLMRoutingConfigService,
    LLMRouterService,
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
    STTProviderRegistry,
    STTService,
  ],
  exports: [LLMService, STTService],
})
export class SimulationModule {}
