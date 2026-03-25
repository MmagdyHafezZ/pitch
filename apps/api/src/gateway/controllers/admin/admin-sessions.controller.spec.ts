import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { of, throwError, firstValueFrom } from 'rxjs';
import { getModelToken } from '@nestjs/mongoose';
import { AdminSessionsController } from './admin-sessions.controller';
import { CheckSystemAdmin } from '../../guards/check-system-admin.guard';
import { JwtService } from '@nestjs/jwt';
import { EventLogModel } from '../../../microservices/simulation/schemas/mongodb/event-log.schema';
import { EnrichedTranscriptModel } from '../../../microservices/simulation/schemas/mongodb/enriched-transcript.schema';
import { LLMTraceModel } from '../../../microservices/simulation/schemas/mongodb/llm-trace.schema';

function makeClientProxy(sendResult: unknown = { status: 'ok' }) {
  return {
    send: jest.fn().mockReturnValue(of(sendResult)),
  };
}

function makeMongooseModel(findResult: unknown[] = [], countResult = 0) {
  const chainable = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(findResult),
  };

  return {
    find: jest.fn().mockReturnValue(chainable),
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(findResult[0] ?? null),
      }),
    }),
    countDocuments: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(countResult),
    }),
    aggregate: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    }),
    _chainable: chainable,
  };
}

describe('AdminSessionsController', () => {
  let controller: AdminSessionsController;
  let simulationService: ReturnType<typeof makeClientProxy>;
  let eventLogModel: ReturnType<typeof makeMongooseModel>;
  let transcriptModel: ReturnType<typeof makeMongooseModel>;
  let llmTraceModel: ReturnType<typeof makeMongooseModel>;

  beforeEach(async () => {
    simulationService = makeClientProxy();
    eventLogModel = makeMongooseModel();
    transcriptModel = makeMongooseModel();
    llmTraceModel = makeMongooseModel();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminSessionsController],
      providers: [
        CheckSystemAdmin,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn().mockReturnValue({ email: 'admin@test.com' }),
          },
        },
        { provide: 'SIMULATION_SERVICE', useValue: simulationService },
        {
          provide: getModelToken(EventLogModel, 'gateway'),
          useValue: eventLogModel,
        },
        {
          provide: getModelToken(EnrichedTranscriptModel, 'gateway'),
          useValue: transcriptModel,
        },
        {
          provide: getModelToken(LLMTraceModel, 'gateway'),
          useValue: llmTraceModel,
        },
      ],
    }).compile();

    controller = module.get<AdminSessionsController>(AdminSessionsController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('listSessions()', () => {
    it('sends LIST_SESSIONS with default limit/offset', async () => {
      const data = { sessions: [], total: 0 };
      simulationService.send.mockReturnValue(of(data));

      const result = await firstValueFrom(controller.listSessions());

      expect(simulationService.send).toHaveBeenCalledWith(
        'simulation.session.list',
        {
          userId: undefined,
          orgId: undefined,
          status: undefined,
          type: undefined,
          limit: 50,
          offset: 0,
        },
      );
      expect(result).toEqual(data);
    });

    it('passes all query filters', async () => {
      simulationService.send.mockReturnValue(of({ sessions: [], total: 0 }));

      await firstValueFrom(
        controller.listSessions('u1', 'org1', 'active', 'practice', '10', '5'),
      );

      expect(simulationService.send).toHaveBeenCalledWith(
        'simulation.session.list',
        {
          userId: 'u1',
          orgId: 'org1',
          status: 'active',
          type: 'practice',
          limit: 10,
          offset: 5,
        },
      );
    });

    it('throws HttpException on service error', async () => {
      simulationService.send.mockReturnValue(
        throwError(() => ({ message: 'DB down', status: 503 })),
      );

      await expect(firstValueFrom(controller.listSessions())).rejects.toThrow(
        HttpException,
      );
    });

    it('uses default error message when none provided', async () => {
      simulationService.send.mockReturnValue(throwError(() => ({})));

      try {
        await firstValueFrom(controller.listSessions());
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).message).toBe('Failed to list sessions');
      }
    });
  });

  describe('getSession()', () => {
    it('sends GET_SESSION with id', async () => {
      const session = { id: 's1', status: 'active' };
      simulationService.send.mockReturnValue(of(session));

      const result = await firstValueFrom(controller.getSession('s1'));

      expect(simulationService.send).toHaveBeenCalledWith(
        'simulation.session.get',
        { id: 's1' },
      );
      expect(result).toEqual(session);
    });

    it('throws HttpException when session not found', async () => {
      simulationService.send.mockReturnValue(
        throwError(() => ({ message: 'Not found', status: 404 })),
      );

      try {
        await firstValueFrom(controller.getSession('bad-id'));
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(404);
      }
    });

    it('defaults to 500 when error has no status', async () => {
      simulationService.send.mockReturnValue(
        throwError(() => new Error('unexpected')),
      );

      try {
        await firstValueFrom(controller.getSession('s1'));
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    });
  });

  describe('getSessionEvents()', () => {
    it('queries eventLogModel with default limit/offset', async () => {
      const events = [{ type: 'msg', createdAt: new Date() }];
      eventLogModel._chainable.exec.mockResolvedValue(events);
      eventLogModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await controller.getSessionEvents('s1');

      expect(eventLogModel.find).toHaveBeenCalledWith({ iterationId: 's1' });
      expect(eventLogModel._chainable.sort).toHaveBeenCalledWith({
        createdAt: 1,
      });
      expect(eventLogModel._chainable.skip).toHaveBeenCalledWith(0);
      expect(eventLogModel._chainable.limit).toHaveBeenCalledWith(100);
      expect(result).toEqual({ events, total: 1 });
    });

    it('parses custom limit/offset', async () => {
      eventLogModel._chainable.exec.mockResolvedValue([]);
      eventLogModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await controller.getSessionEvents('s1', '25', '10');

      expect(eventLogModel._chainable.skip).toHaveBeenCalledWith(10);
      expect(eventLogModel._chainable.limit).toHaveBeenCalledWith(25);
    });
  });

  describe('getSessionTranscript()', () => {
    it('returns transcript when found', async () => {
      const transcript = { iterationId: 's1', text: 'hello' };
      transcriptModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(transcript),
        }),
      });

      const result = await controller.getSessionTranscript('s1');

      expect(transcriptModel.findOne).toHaveBeenCalledWith({
        iterationId: 's1',
      });
      expect(result).toEqual(transcript);
    });

    it('throws 404 when transcript not found', async () => {
      transcriptModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      try {
        await controller.getSessionTranscript('bad-id');
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
        expect((err as HttpException).message).toBe('Transcript not found');
      }
    });
  });

  describe('getSessionLlmCalls()', () => {
    it('queries llmTraceModel with default limit/offset', async () => {
      const traces = [{ model: 'gpt-4', tokens: 100 }];
      const chainable = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(traces),
      };
      llmTraceModel.find.mockReturnValue(chainable);
      llmTraceModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await controller.getSessionLlmCalls('s1');

      expect(llmTraceModel.find).toHaveBeenCalledWith({ iterationId: 's1' });
      expect(chainable.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(chainable.skip).toHaveBeenCalledWith(0);
      expect(chainable.limit).toHaveBeenCalledWith(50);
      expect(result).toEqual({ traces, total: 1 });
    });

    it('parses custom limit/offset', async () => {
      const chainable = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      llmTraceModel.find.mockReturnValue(chainable);
      llmTraceModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await controller.getSessionLlmCalls('s1', '20', '5');

      expect(chainable.skip).toHaveBeenCalledWith(5);
      expect(chainable.limit).toHaveBeenCalledWith(20);
    });
  });

  describe('forceEndSession()', () => {
    it('sends END_SESSION with reason', async () => {
      simulationService.send.mockReturnValue(of({ ended: true }));

      const result = await firstValueFrom(controller.forceEndSession('s1'));

      expect(simulationService.send).toHaveBeenCalledWith(
        'simulation.session.end',
        {
          sessionId: 's1',
          reason: 'force-ended by admin',
        },
      );
      expect(result).toEqual({ ended: true });
    });

    it('throws HttpException on error', async () => {
      simulationService.send.mockReturnValue(
        throwError(() => ({ message: 'Session already ended', status: 400 })),
      );

      try {
        await firstValueFrom(controller.forceEndSession('s1'));
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(400);
      }
    });
  });

  describe('recomputeAssessment()', () => {
    it('sends ASSESSMENT_RUN with correct params', async () => {
      simulationService.send.mockReturnValue(of({ status: 'recomputing' }));

      const result = await firstValueFrom(controller.recomputeAssessment('s1'));

      expect(simulationService.send).toHaveBeenCalledWith('assessment.run', {
        sessionId: 's1',
        mode: 'final',
        forceRecalculate: true,
        requestedBy: 'admin',
      });
      expect(result).toEqual({ status: 'recomputing' });
    });

    it('throws HttpException on error', async () => {
      simulationService.send.mockReturnValue(
        throwError(() => ({
          message: 'Assessment engine unavailable',
          status: 503,
        })),
      );

      await expect(
        firstValueFrom(controller.recomputeAssessment('s1')),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('deleteSession()', () => {
    it('sends DELETE_SESSION with id and isAdmin', async () => {
      simulationService.send.mockReturnValue(of({ deleted: true }));

      const result = await firstValueFrom(controller.deleteSession('s1'));

      expect(simulationService.send).toHaveBeenCalledWith(
        'simulation.session.delete',
        { id: 's1', isAdmin: true },
      );
      expect(result).toEqual({ deleted: true });
    });

    it('throws HttpException on error', async () => {
      simulationService.send.mockReturnValue(
        throwError(() => ({ message: 'Session not found', status: 404 })),
      );

      try {
        await firstValueFrom(controller.deleteSession('bad-id'));
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(404);
      }
    });

    it('uses default error message when none in error', async () => {
      simulationService.send.mockReturnValue(throwError(() => ({})));

      try {
        await firstValueFrom(controller.deleteSession('s1'));
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).message).toBe('Failed to delete session');
      }
    });
  });
});
