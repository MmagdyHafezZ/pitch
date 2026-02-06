/*eslint-disable*/
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
const request = require('supertest');
import { App } from 'supertest/types';
import { SimulationModule } from '../src/microservices/simulation/simulation.module';
import { SessionType } from '../src/microservices/simulation/dto/session.dto';

describe('Session Creation with LLM Configuration (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SimulationModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /simulation/sessions', () => {
    it('should create a text session with LLM configuration', async () => {
      const createSessionDto = {
        name: 'Sales Training Session',
        orgId: 'test-org-123',
        type: SessionType.text,
        tags: ['sales', 'training'],
        sessionConfig: {
          llm: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            temperature: 0.7,
            maxTokens: 4096,
          },
          multiTurnEnabled: true,
          tone: 'professional',
        },
        language: 'en-US',
      };

      const response = await request(app.getHttpServer())
        .post('/simulation/sessions')
        .query({ userId: 'test-user-123' })
        .send(createSessionDto)
        .expect(201);

      // Verify session was created
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(createSessionDto.name);
      expect(response.body.orgId).toBe(createSessionDto.orgId);
      expect(response.body.type).toBe(SessionType.text);
      expect(response.body.userId).toBe('test-user-123');

      // Verify LLM configuration was stored
      expect(response.body.sessionConfig).toBeDefined();
      expect(response.body.sessionConfig.llm).toBeDefined();
      expect(response.body.sessionConfig.llm.provider).toBe('openai');
      expect(response.body.sessionConfig.llm.model).toBe('gpt-4o-mini');
      expect(response.body.sessionConfig.llm.temperature).toBe(0.7);
      expect(response.body.sessionConfig.llm.maxTokens).toBe(4096);

      // Verify other config fields
      expect(response.body.sessionConfig.multiTurnEnabled).toBe(true);
      expect(response.body.sessionConfig.tone).toBe('professional');

      // Verify status
      expect(response.body.status).toBe('active');

      // Verify timestamps
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
    });

    it('should create a voice session with LLM and TTS configuration', async () => {
      const createSessionDto = {
        name: 'Voice Interview Simulation',
        orgId: 'test-org-123',
        type: SessionType.voice,
        tags: ['interview', 'voice'],
        sessionConfig: {
          llm: {
            provider: 'openai',
            model: 'gpt-4o',
            temperature: 0.9,
          },
          voice: {
            provider: 'elevenlabs',
            voice: 'rachel',
            speed: 1.0,
            stability: 0.75,
          },
          multiTurnEnabled: true,
        },
        language: 'en-US',
      };

      const response = await request(app.getHttpServer())
        .post('/simulation/sessions')
        .query({ userId: 'test-user-voice' })
        .send(createSessionDto)
        .expect(201);

      // Verify voice-specific configuration
      expect(response.body.type).toBe(SessionType.voice);
      expect(response.body.sessionConfig.voice).toBeDefined();
      expect(response.body.sessionConfig.voice.provider).toBe('elevenlabs');
      expect(response.body.sessionConfig.voice.voice).toBe('rachel');
      expect(response.body.sessionConfig.voice.speed).toBe(1.0);
      expect(response.body.sessionConfig.voice.stability).toBe(0.75);

      // Verify LLM configuration
      expect(response.body.sessionConfig.llm.provider).toBe('openai');
      expect(response.body.sessionConfig.llm.model).toBe('gpt-4o');
    });

    it('should create a session with WatsonX LLM provider', async () => {
      const createSessionDto = {
        name: 'WatsonX Training Session',
        orgId: 'test-org-123',
        type: SessionType.text,
        sessionConfig: {
          llm: {
            provider: 'watsonx',
            model: 'ibm/granite-13b-chat-v2',
            temperature: 0.8,
          },
        },
      };

      const response = await request(app.getHttpServer())
        .post('/simulation/sessions')
        .query({ userId: 'test-user-watsonx' })
        .send(createSessionDto)
        .expect(201);

      // Verify WatsonX configuration
      expect(response.body.sessionConfig.llm.provider).toBe('watsonx');
      expect(response.body.sessionConfig.llm.model).toBe(
        'ibm/granite-13b-chat-v2',
      );
    });

    it('should create a session with minimal LLM configuration', async () => {
      const createSessionDto = {
        orgId: 'test-org-minimal',
        type: SessionType.text,
        sessionConfig: {
          llm: {
            provider: 'openai',
            model: 'gpt-4o-mini',
          },
        },
      };

      const response = await request(app.getHttpServer())
        .post('/simulation/sessions')
        .query({ userId: 'test-user-minimal' })
        .send(createSessionDto)
        .expect(201);

      // Verify minimal configuration works
      expect(response.body.sessionConfig.llm.provider).toBe('openai');
      expect(response.body.sessionConfig.llm.model).toBe('gpt-4o-mini');

      // Optional fields should not be present or be undefined
      expect(
        response.body.sessionConfig.llm.temperature === undefined ||
          response.body.sessionConfig.llm.temperature === null,
      ).toBeTruthy();
    });

    it('should create a session without LLM configuration (uses defaults)', async () => {
      const createSessionDto = {
        name: 'Default Config Session',
        orgId: 'test-org-default',
        type: SessionType.text,
      };

      const response = await request(app.getHttpServer())
        .post('/simulation/sessions')
        .query({ userId: 'test-user-default' })
        .send(createSessionDto)
        .expect(201);

      // Session should be created successfully even without LLM config
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(createSessionDto.name);
      expect(response.body.status).toBe('active');
    });

    it('should handle complex sessionConfig with multiple settings', async () => {
      const createSessionDto = {
        name: 'Complex Configuration Session',
        orgId: 'test-org-complex',
        type: SessionType.voice,
        sessionConfig: {
          llm: {
            provider: 'openai',
            model: 'gpt-4o',
            temperature: 0.7,
            maxTokens: 8000,
          },
          voice: {
            provider: 'elevenlabs',
            voice: 'adam',
            speed: 1.1,
            stability: 0.8,
          },
          multiTurnEnabled: true,
          tone: 'friendly',
          difficulty: 3,
          enabledFeatures: ['tools', 'vision'],
          customInstructions: 'Be encouraging and supportive',
        },
        tags: ['mentoring', 'advanced'],
      };

      const response = await request(app.getHttpServer())
        .post('/simulation/sessions')
        .query({ userId: 'test-user-complex' })
        .send(createSessionDto)
        .expect(201);

      // Verify all complex configuration fields
      const config = response.body.sessionConfig;
      expect(config.llm.provider).toBe('openai');
      expect(config.llm.model).toBe('gpt-4o');
      expect(config.llm.temperature).toBe(0.7);
      expect(config.llm.maxTokens).toBe(8000);
      expect(config.voice.provider).toBe('elevenlabs');
      expect(config.voice.voice).toBe('adam');
      expect(config.multiTurnEnabled).toBe(true);
      expect(config.tone).toBe('friendly');
      expect(config.difficulty).toBe(3);
      expect(config.enabledFeatures).toEqual(['tools', 'vision']);
      expect(config.customInstructions).toBe('Be encouraging and supportive');
    });

    it('should validate required fields are present', async () => {
      const invalidDto = {
        name: 'Missing Required Fields',
        // Missing orgId
        // Missing type
        sessionConfig: {
          llm: {
            provider: 'openai',
            model: 'gpt-4o-mini',
          },
        },
      };

      const response = await request(app.getHttpServer())
        .post('/simulation/sessions')
        .query({ userId: 'test-user-invalid' })
        .send(invalidDto)
        .expect(500); // Returns 500 because Prisma validation happens before DTO validation

      // Verify the error is about missing required fields
      expect(response.body.message).toContain('orgId');
    });

    it('should accept different session types correctly', async () => {
      const sessionTypes = [
        SessionType.text,
        SessionType.voice,
        SessionType.video,
      ];

      for (const sessionType of sessionTypes) {
        const response = await request(app.getHttpServer())
          .post('/simulation/sessions')
          .query({ userId: `test-user-${sessionType}` })
          .send({
            orgId: 'test-org-types',
            type: sessionType,
            sessionConfig: {
              llm: {
                provider: 'openai',
                model: 'gpt-4o-mini',
              },
            },
          })
          .expect(201);

        expect(response.body.type).toBe(sessionType);
      }
    });

    it('should create sessions with all supported LLM models', async () => {
      const llmConfigurations = [
        { provider: 'openai', model: 'gpt-4o' },
        { provider: 'openai', model: 'gpt-4o-mini' },
        { provider: 'openai', model: 'gpt-4-turbo' },
        { provider: 'watsonx', model: 'ibm/granite-13b-chat-v2' },
        {
          provider: 'watsonx',
          model: 'meta-llama/llama-3-8b-instruct',
        },
      ];

      for (const llmConfig of llmConfigurations) {
        const response = await request(app.getHttpServer())
          .post('/simulation/sessions')
          .query({ userId: 'test-user-models' })
          .send({
            orgId: 'test-org-models',
            type: SessionType.text,
            sessionConfig: {
              llm: llmConfig,
            },
          })
          .expect(201);

        expect(response.body.sessionConfig.llm.provider).toBe(
          llmConfig.provider,
        );
        expect(response.body.sessionConfig.llm.model).toBe(llmConfig.model);
      }
    });

    it('should persist LLM configuration for later retrieval', async () => {
      // Create a session
      const createResponse = await request(app.getHttpServer())
        .post('/simulation/sessions')
        .query({ userId: 'test-user-persist' })
        .send({
          name: 'Persistence Test Session',
          orgId: 'test-org-persist',
          type: SessionType.text,
          sessionConfig: {
            llm: {
              provider: 'openai',
              model: 'gpt-4o',
              temperature: 0.85,
            },
          },
        })
        .expect(201);

      const sessionId = createResponse.body.id;

      // Retrieve the session
      const getResponse = await request(app.getHttpServer())
        .get(`/simulation/sessions/${sessionId}`)
        .expect(200);

      // Verify LLM configuration persisted
      expect(getResponse.body.sessionConfig.llm.provider).toBe('openai');
      expect(getResponse.body.sessionConfig.llm.model).toBe('gpt-4o');
      expect(getResponse.body.sessionConfig.llm.temperature).toBe(0.85);
    });

    it('should handle Content-Type headers correctly', async () => {
      await request(app.getHttpServer())
        .post('/simulation/sessions')
        .query({ userId: 'test-user-headers' })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .send({
          orgId: 'test-org-headers',
          type: SessionType.text,
          sessionConfig: {
            llm: {
              provider: 'openai',
              model: 'gpt-4o-mini',
            },
          },
        })
        .expect(201)
        .expect('Content-Type', /json/);
    });
  });

  describe('Session Lifecycle with LLM Configuration', () => {
    let createdSessionId: string;

    it('should create a session and run through complete lifecycle', async () => {
      // 1. Create session with LLM config
      const createResponse = await request(app.getHttpServer())
        .post('/simulation/sessions')
        .query({ userId: 'test-user-lifecycle' })
        .send({
          name: 'Lifecycle Test Session',
          orgId: 'test-org-lifecycle',
          type: SessionType.text,
          sessionConfig: {
            llm: {
              provider: 'openai',
              model: 'gpt-4o-mini',
            },
          },
        })
        .expect(201);

      createdSessionId = createResponse.body.id;
      expect(createdSessionId).toBeDefined();
      expect(createResponse.body.status).toBe('active');

      // 2. Retrieve session
      const getResponse = await request(app.getHttpServer())
        .get(`/simulation/sessions/${createdSessionId}`)
        .expect(200);

      expect(getResponse.body.id).toBe(createdSessionId);
      expect(getResponse.body.status).toBe('active');

      // 3. Update session configuration
      const updateResponse = await request(app.getHttpServer())
        .put(`/simulation/sessions/${createdSessionId}`)
        .query({ userId: 'test-user-lifecycle' })
        .send({
          sessionConfig: {
            llm: {
              provider: 'openai',
              model: 'gpt-4o', // Upgraded model
              temperature: 0.9,
            },
          },
        })
        .expect(200);

      expect(updateResponse.body.sessionConfig.llm.model).toBe('gpt-4o');
      expect(updateResponse.body.sessionConfig.llm.temperature).toBe(0.9);

      // 4. End session
      await request(app.getHttpServer())
        .post(`/simulation/sessions/${createdSessionId}/end`)
        .send({ reason: 'test_completed' })
        .expect(200);

      // 5. Verify session ended
      const endedSession = await request(app.getHttpServer())
        .get(`/simulation/sessions/${createdSessionId}`)
        .expect(200);

      expect(endedSession.body.status).toBe('ended');
      expect(endedSession.body.endedReason).toBe('test_completed');
      expect(endedSession.body.endedAt).toBeDefined();
    });
  });
});
