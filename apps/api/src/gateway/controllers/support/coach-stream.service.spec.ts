import type { ConfigService } from '@nestjs/config';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import type { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { CoachStreamService } from './coach-stream.service';
import type { SupportAttachmentStorageService } from './support-attachment-storage.service';

type ResponsesCreateRequest = {
  model?: string;
  input?: Array<{
    role?: string;
  }>;
};

type CoachStreamServiceInternals = {
  openai: {
    responses: {
      create: jest.Mock<
        Promise<{ output_text?: string }>,
        [ResponsesCreateRequest]
      >;
    };
  };
  parseDocumentBuffer: (
    buffer: Buffer,
    contentType: string,
    source: string,
  ) => Promise<string>;
  generateScenarioForSession: (params: {
    orgId: string;
    userClaims: { id: string; email: string; name: string };
    name: string;
    type: string;
    topic: string;
    objective?: string;
    context?: string;
    aiRole: string;
    userRole: string;
    tone?: string;
    difficulty?: string;
    tags?: string[];
    personaId?: string;
    existingConfig?: Record<string, unknown>;
    calendarEventId?: string;
    calendarProvider?: string;
  }) => Promise<{
    scenarioId: string;
    name: string;
    description?: string;
    config: Record<string, unknown>;
    language: string;
  }>;
};

describe('CoachStreamService', () => {
  const createConfigServiceMock = (
    values: Record<string, string | undefined>,
  ): ConfigService =>
    ({
      get: jest.fn((key: string) => values[key]),
    }) as unknown as ConfigService;

  const createAttachmentStorageMock =
    (): jest.Mocked<SupportAttachmentStorageService> =>
      ({
        resolveInternalDownloadUrl: jest.fn(),
        getObjectFromStorage: jest.fn(),
      }) as unknown as jest.Mocked<SupportAttachmentStorageService>;

  const createClientProxyMock = (
    handler: (pattern: string, payload: unknown) => unknown,
  ): ClientProxy =>
    ({
      send: jest.fn((pattern: string, payload: unknown) =>
        of(handler(pattern, payload)),
      ),
    }) as unknown as ClientProxy;

  const readRecord = (
    value: unknown,
    key: string,
  ): Record<string, unknown> | undefined => {
    if (typeof value !== 'object' || value === null) {
      return;
    }

    const field = (value as Record<string, unknown>)[key];
    return typeof field === 'object' && field !== null
      ? (field as Record<string, unknown>)
      : undefined;
  };

  const readString = (value: unknown, key: string): string | undefined => {
    if (typeof value !== 'object' || value === null) {
      return;
    }

    const field = (value as Record<string, unknown>)[key];
    return typeof field === 'string' ? field : undefined;
  };

  it('uses OpenAI file inputs to extract PDF content', async () => {
    const attachmentStorage = createAttachmentStorageMock();
    const service = new CoachStreamService(
      createConfigServiceMock({
        OPENAI_API_KEY: 'test-key',
        OPENAI_DOCUMENT_MODEL: 'gpt-4o-mini',
      }),
      undefined,
      undefined,
      undefined,
      attachmentStorage,
    );
    const internals = service as unknown as CoachStreamServiceInternals;
    const responsesCreate = jest.fn<
      Promise<{ output_text?: string }>,
      [ResponsesCreateRequest]
    >();
    responsesCreate.mockResolvedValue({
      output_text: 'Extracted PDF text',
    });
    internals.openai = {
      responses: {
        create: responsesCreate,
      },
    };

    const result = await internals.parseDocumentBuffer(
      Buffer.from('%PDF-1.4'),
      'application/pdf',
      'http://localhost:8000/document.pdf',
    );

    expect(result).toBe('Extracted PDF text');
    const [request] = responsesCreate.mock.calls[0] ?? [];

    expect(request?.model).toBe('gpt-4o-mini');
    expect(request?.input?.[0]).toMatchObject({
      role: 'user',
    });
  });

  it('builds a persisted generated scenario into a rich session config', async () => {
    const simulationClient = createClientProxyMock((pattern, payload) => {
      if (pattern === SIMULATION_SERVICE_PATTERNS.GENERATE_SCENARIO) {
        expect(payload).toMatchObject({
          orgId: 'workspace-1',
          name: 'WatsonX AI',
          type: 'text',
          userClaims: {
            id: 'user-1',
            email: 'seller@example.com',
            name: 'Seller',
          },
        });

        return {
          name: 'Prepare for WatsonX AI buyer meeting',
          description:
            'A skeptical buyer is testing whether the pitch is real.',
          config: {
            objective: 'Earn agreement on a concrete next step.',
            background:
              'The buyer wants proof the solution fits enterprise requirements.',
            context:
              'The buyer wants proof the solution fits enterprise requirements.',
            roles: {
              assistant: 'Skeptical enterprise buyer',
              user: 'Account Executive',
            },
            constraints: ['Limited implementation bandwidth'],
            successCriteria: ['Leave with a committed follow-up action'],
            stakes: ['The deal loses momentum without a next step'],
            stages: [
              {
                label: 'Discovery',
                description: 'Surface enterprise concerns',
              },
            ],
            difficulty: 'hard',
            durationMinutes: 30,
            language: 'en-US',
          },
        };
      }

      if (pattern === SIMULATION_SERVICE_PATTERNS.CREATE_SCENARIO) {
        expect(payload).toMatchObject({
          orgId: 'workspace-1',
          name: 'Prepare for WatsonX AI buyer meeting',
          visibility: 'PRIVATE',
        });

        return { id: 'scenario-1' };
      }

      throw new Error(`Unexpected pattern: ${pattern}`);
    });

    const service = new CoachStreamService(
      createConfigServiceMock({
        OPENAI_API_KEY: 'test-key',
        OPENAI_DOCUMENT_MODEL: 'gpt-4o-mini',
      }),
      undefined,
      simulationClient,
      undefined,
      createAttachmentStorageMock(),
    );

    const internals = service as unknown as CoachStreamServiceInternals;
    const generated = await internals.generateScenarioForSession({
      orgId: 'workspace-1',
      userClaims: {
        id: 'user-1',
        email: 'seller@example.com',
        name: 'Seller',
      },
      name: 'WatsonX AI Practice Session',
      type: 'text',
      topic: 'WatsonX AI',
      objective: 'Secure a concrete next meeting.',
      context: 'Upcoming buyer conversation with enterprise concerns.',
      aiRole: 'Skeptical enterprise buyer',
      userRole: 'Account Executive',
      tone: 'professional',
      difficulty: 'challenging',
    });

    expect(generated.scenarioId).toBe('scenario-1');
    expect(generated.name).toBe('Prepare for WatsonX AI buyer meeting');
    expect(generated.language).toBe('en-US');
    expect(generated.config).toMatchObject({
      aiRole: 'Skeptical enterprise buyer',
      userRole: 'Account Executive',
      tone: 'professional',
      difficulty: 7,
      durationMinutes: 30,
      scenario: {
        name: 'Prepare for WatsonX AI buyer meeting',
        topic: 'WatsonX AI',
        objective: 'Earn agreement on a concrete next step.',
      },
      counterpartProfile: {
        role: 'Skeptical enterprise buyer',
        background:
          'The buyer wants proof the solution fits enterprise requirements.',
      },
    });
  });

  it('upgrades generic counterpart roles when the session context clearly describes a buyer evaluation', async () => {
    const simulationClient = createClientProxyMock((pattern) => {
      if (pattern === SIMULATION_SERVICE_PATTERNS.GENERATE_SCENARIO) {
        return {
          name: 'Codex buyer presentation',
          description: 'A client is evaluating Codex for team adoption.',
          config: {
            objective: 'Handle integration concerns and win a next step.',
            background:
              'The client is evaluating Codex for its engineering workflow.',
            roles: {
              assistant: 'Professional counterpart',
              user: 'Account Executive',
            },
            durationMinutes: 20,
            language: 'en-US',
          },
        };
      }

      if (pattern === SIMULATION_SERVICE_PATTERNS.CREATE_SCENARIO) {
        return { id: 'scenario-2' };
      }

      throw new Error(`Unexpected pattern: ${pattern}`);
    });

    const service = new CoachStreamService(
      createConfigServiceMock({
        OPENAI_API_KEY: 'test-key',
        OPENAI_DOCUMENT_MODEL: 'gpt-4o-mini',
      }),
      undefined,
      simulationClient,
      undefined,
      createAttachmentStorageMock(),
    );

    const internals = service as unknown as CoachStreamServiceInternals;
    const generated = await internals.generateScenarioForSession({
      orgId: 'workspace-1',
      userClaims: {
        id: 'user-1',
        email: 'seller@example.com',
        name: 'Seller',
      },
      name: 'Codex Practice Session',
      type: 'text',
      topic: 'Codex',
      objective: 'Prepare for a product presentation on Codex.',
      context:
        'The client is evaluating Codex for integration into their software development workflow.',
      aiRole: 'Professional counterpart',
      userRole: 'Account Executive',
      tone: 'professional',
      difficulty: 'medium',
    });

    expect(readString(generated.config, 'aiRole')).toBe(
      'Technical stakeholder evaluating Codex',
    );
    expect(
      readString(readRecord(generated.config, 'counterpartProfile'), 'role'),
    ).toBe('Technical stakeholder evaluating Codex');
    expect(
      readString(
        readRecord(readRecord(generated.config, 'scenario'), 'roles'),
        'assistant',
      ),
    ).toBe('Technical stakeholder evaluating Codex');
  });
});
