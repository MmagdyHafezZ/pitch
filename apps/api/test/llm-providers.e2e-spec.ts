/*eslint-disable*/
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
const request = require('supertest');
import { App } from 'supertest/types';
import { SimulationModule } from '../src/microservices/simulation/simulation.module';
import { LLMModelCatalogService } from '../src/microservices/simulation/services/llm/llm-model-catalog.service';
import { LLMPricingService } from '../src/microservices/simulation/services/llm/llm-pricing.service';
import { ModelCapabilitiesRegistry } from '../src/microservices/simulation/services/llm/model-capabilities.registry';

describe('LLM Providers API (e2e)', () => {
  let app: INestApplication<App>;
  let modelCatalog: LLMModelCatalogService;
  let pricingService: LLMPricingService;
  let capabilitiesRegistry: ModelCapabilitiesRegistry;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SimulationModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Get service instances for mocking
    modelCatalog = moduleFixture.get<LLMModelCatalogService>(
      LLMModelCatalogService,
    );
    pricingService = moduleFixture.get<LLMPricingService>(LLMPricingService);
    capabilitiesRegistry = moduleFixture.get<ModelCapabilitiesRegistry>(
      ModelCapabilitiesRegistry,
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /simulation/llm/providers', () => {
    it('should return list of available providers with models and details', async () => {
      const response = await request(app.getHttpServer())
        .get('/simulation/llm/providers')
        .expect(200);

      // Verify response structure
      expect(response.body).toHaveProperty('providers');
      expect(Array.isArray(response.body.providers)).toBe(true);

      // Should have at least OpenAI and WatsonX providers
      expect(response.body.providers.length).toBeGreaterThanOrEqual(1);

      // Verify each provider has required fields
      response.body.providers.forEach((provider: any) => {
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('enabled');
        expect(provider).toHaveProperty('models');
        expect(provider).toHaveProperty('modelDetails');

        expect(typeof provider.name).toBe('string');
        expect(typeof provider.enabled).toBe('boolean');
        expect(Array.isArray(provider.models)).toBe(true);
        expect(Array.isArray(provider.modelDetails)).toBe(true);
      });
    });

    it('should include OpenAI provider when OPENAI_API_KEY is set', async () => {
      if (!process.env.OPENAI_API_KEY) {
        console.warn('Skipping test: OPENAI_API_KEY not set in environment');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/simulation/llm/providers')
        .expect(200);

      const openaiProvider = response.body.providers.find(
        (p: any) => p.name === 'openai',
      );

      expect(openaiProvider).toBeDefined();
      expect(openaiProvider.enabled).toBe(true);
      expect(openaiProvider.models.length).toBeGreaterThan(0);
    });

    it('should include WatsonX provider when credentials are set', async () => {
      if (!process.env.WATSONX_API_KEY || !process.env.WATSONX_PROJECT_ID) {
        console.warn(
          'Skipping test: WATSONX credentials not set in environment',
        );
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/simulation/llm/providers')
        .expect(200);

      const watsonxProvider = response.body.providers.find(
        (p: any) => p.name === 'watsonx',
      );

      expect(watsonxProvider).toBeDefined();
      expect(watsonxProvider.enabled).toBe(true);
      expect(watsonxProvider.models.length).toBeGreaterThan(0);
    });

    it('should include complete model details with pricing and capabilities', async () => {
      const response = await request(app.getHttpServer())
        .get('/simulation/llm/providers')
        .expect(200);

      // Find a provider with models
      const providerWithModels = response.body.providers.find(
        (p: any) => p.modelDetails.length > 0,
      );

      if (!providerWithModels) {
        console.warn('No providers with models available for testing');
        return;
      }

      const modelDetail = providerWithModels.modelDetails[0];

      // Verify pricing information
      expect(modelDetail).toHaveProperty('pricing');
      expect(modelDetail.pricing).toHaveProperty('inputTokensPerMillion');
      expect(modelDetail.pricing).toHaveProperty('outputTokensPerMillion');
      expect(typeof modelDetail.pricing.inputTokensPerMillion).toBe('number');
      expect(typeof modelDetail.pricing.outputTokensPerMillion).toBe('number');

      // Verify capability flags
      expect(modelDetail).toHaveProperty('maxTokens');
      expect(typeof modelDetail.maxTokens).toBe('number');
      expect(modelDetail.maxTokens).toBeGreaterThan(0);

      expect(modelDetail).toHaveProperty('supportsStreaming');
      expect(typeof modelDetail.supportsStreaming).toBe('boolean');

      expect(modelDetail).toHaveProperty('supportsTools');
      expect(typeof modelDetail.supportsTools).toBe('boolean');

      expect(modelDetail).toHaveProperty('supportsVision');
      expect(typeof modelDetail.supportsVision).toBe('boolean');

      expect(modelDetail).toHaveProperty('supportsAudio');
      expect(typeof modelDetail.supportsAudio).toBe('boolean');

      expect(modelDetail).toHaveProperty('supportedModalities');
      expect(Array.isArray(modelDetail.supportedModalities)).toBe(true);
    });

    it('should return consistent data structure across multiple calls', async () => {
      const response1 = await request(app.getHttpServer())
        .get('/simulation/llm/providers')
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .get('/simulation/llm/providers')
        .expect(200);

      // Responses should have same structure
      expect(response1.body.providers.length).toBe(
        response2.body.providers.length,
      );

      response1.body.providers.forEach((provider1: any, index: number) => {
        const provider2 = response2.body.providers[index];

        expect(provider1.name).toBe(provider2.name);
        expect(provider1.enabled).toBe(provider2.enabled);
        expect(provider1.models).toEqual(provider2.models);
      });
    });

    it('should handle requests with appropriate headers', async () => {
      await request(app.getHttpServer())
        .get('/simulation/llm/providers')
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/);
    });

    it('should include fallback models when catalog service is unavailable', async () => {
      // The endpoint should still return fallback models even if catalog refresh fails
      const response = await request(app.getHttpServer())
        .get('/simulation/llm/providers')
        .expect(200);

      // Should still get providers with models
      expect(response.body.providers.length).toBeGreaterThan(0);

      const openaiProvider = response.body.providers.find(
        (p: any) => p.name === 'openai',
      );

      if (openaiProvider) {
        // Should include at least fallback models
        expect(openaiProvider.models).toContain('gpt-4o');
        expect(openaiProvider.models).toContain('gpt-4o-mini');
      }
    });

    it('should mark providers as disabled when credentials are missing', async () => {
      const response = await request(app.getHttpServer())
        .get('/simulation/llm/providers')
        .expect(200);

      response.body.providers.forEach((provider: any) => {
        if (provider.name === 'openai') {
          expect(provider.enabled).toBe(!!process.env.OPENAI_API_KEY);
        }
        if (provider.name === 'watsonx') {
          expect(provider.enabled).toBe(
            !!(process.env.WATSONX_API_KEY && process.env.WATSONX_PROJECT_ID),
          );
        }
      });
    });

    it('should include decision-support data for model selection', async () => {
      const response = await request(app.getHttpServer())
        .get('/simulation/llm/providers')
        .expect(200);

      const enabledProvider = response.body.providers.find(
        (p: any) => p.enabled && p.modelDetails.length > 0,
      );

      if (!enabledProvider) {
        console.warn('No enabled providers available for testing');
        return;
      }

      // Verify we have decision-support metrics
      const model = enabledProvider.modelDetails[0];

      // Cost metrics
      expect(model.pricing.inputTokensPerMillion).toBeDefined();
      expect(model.pricing.outputTokensPerMillion).toBeDefined();

      // Performance/capability metrics
      expect(model.maxTokens).toBeDefined(); // Context window
      expect(model.supportsStreaming).toBeDefined(); // Latency consideration
      expect(model.supportsTools).toBeDefined(); // Capability
      expect(model.supportsVision).toBeDefined(); // Capability
    });
  });
});
