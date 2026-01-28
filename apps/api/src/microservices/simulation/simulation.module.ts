import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatController } from './controllers/chat.controller';
import { LLMRoutingController } from './controllers/llm-routing.controller';
import { LLMTestController } from './controllers/llm-test.controller';
import { SessionController } from './controllers/session.controller';
import { SessionHttpController } from './controllers/session-http.controller';
import { SessionMemberController } from './controllers/session-member.controller';
import { InvitationController } from './controllers/invitation.controller';
import { InvitationHttpController } from './controllers/invitation-http.controller';
import { ConversationController } from './controllers/conversation.controller';
import { PersonaHttpController } from './controllers/persona-http.controller';
import { SimulationPrismaService } from './prisma/simulation-prisma.service';
import { MongoConnectionService } from './services/mongo/mongo-connection.service';
import { LLMService } from './services/llm/llm.service';
import { UsageCalculatorService } from './services/llm/usage-calculator.service';
import { ModelCapabilitiesRegistry } from './services/llm/model-capabilities.registry';
import { LLMRoutingConfigService } from './services/llm/llm-routing-config.service';
import { LLMRouterService } from './services/llm/llm-router.service';
import { LLMModelCatalogService } from './services/llm/llm-model-catalog.service';
import { LLMPricingService } from './services/llm/llm-pricing.service';
import { LLMProviderRegistry } from './providers/llm/llm-provider.registry';
import { OpenAIProvider } from './providers/llm/openai.provider';
import { WatsonxProvider } from './providers/llm/watsonx.provider';
import { SessionService } from './services/session.service';
import { SessionMemberService } from './services/session-member.service';
import { SessionRepository } from './repositories/session.repository';
import { SessionMemberRepository } from './repositories/session-member.repository';
import { InvitationService } from './services/invitation.service';
import { InvitationRepository } from './repositories/invitation.repository';
import { PersonaService } from './services/persona.service';
import { PersonaRepository } from './repositories/persona.repository';
import { RedisModule } from '@pitch/shared-backend/redis/index';
import { TtsModule } from './tts/tts.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        url: configService.get<string>('REDIS_URL'),
      }),
      inject: [ConfigService],
    }),
    TtsModule,
  ],
  controllers: [
    ChatController,
    LLMRoutingController,
    LLMTestController,
    SessionController,
    SessionHttpController,
    SessionMemberController,
    InvitationController,
    InvitationHttpController,
    ConversationController,
    PersonaHttpController,
  ],
  providers: [
    SimulationPrismaService,
    MongoConnectionService,
    LLMProviderRegistry,
    ModelCapabilitiesRegistry,
    LLMRoutingConfigService,
    LLMRouterService,
    LLMModelCatalogService,
    LLMPricingService,
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
    SessionRepository,
    SessionService,
    SessionMemberRepository,
    SessionMemberService,
    InvitationRepository,
    InvitationService,
    PersonaRepository,
    PersonaService,
  ],
  exports: [
    LLMService,
    SessionService,
    SessionMemberService,
    InvitationService,
    PersonaService,
  ],
})
export class SimulationModule {}
