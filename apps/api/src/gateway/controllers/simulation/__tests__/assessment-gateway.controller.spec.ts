import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError, lastValueFrom } from 'rxjs';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { AssessmentGatewayController } from '../assessment-gateway.controller';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { GlobalJwtAuthGuard } from '../../../guards/global-jwt-auth.guard';
import { UserClaimsInterceptor } from '../../../interceptors/user-claims.interceptor';

const createClientProxyMock = (): jest.Mocked<
  Pick<ClientProxy, 'send' | 'emit'>
> => ({
  send: jest.fn(),
  emit: jest.fn(),
});

const userClaims = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
};

describe('AssessmentGatewayController', () => {
  let controller: AssessmentGatewayController;
  let simulationService: ReturnType<typeof createClientProxyMock>;

  beforeEach(async () => {
    simulationService = createClientProxyMock();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssessmentGatewayController],
      providers: [
        { provide: 'SIMULATION_SERVICE', useValue: simulationService },
      ],
    })
      .overrideGuard(GlobalJwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideInterceptor(UserClaimsInterceptor)
      .useValue({ intercept: (_: unknown, next: any) => next.handle() })
      .compile();

    controller = module.get(AssessmentGatewayController);
  });

  afterEach(() => jest.clearAllMocks());

  // ── runAssessment ─────────────────────────────────────────────────────────

  describe('runAssessment()', () => {
    it('sends ASSESSMENT_RUN with payload merged with requestedBy and returns result', async () => {
      const payload = { sessionId: 'sess-1', type: 'final' };
      const response = { runId: 'run-1', status: 'queued' };
      simulationService.send.mockReturnValue(of(response));

      const result = await lastValueFrom(
        controller.runAssessment(payload, userClaims as any),
      );

      expect(simulationService.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.ASSESSMENT_RUN,
        { sessionId: 'sess-1', type: 'final', requestedBy: 'user-123' },
      );
      expect(result).toEqual(response);
    });

    it('throws HttpException when simulation service errors', async () => {
      simulationService.send.mockReturnValue(
        throwError(() => ({
          message: 'run failed',
          status: HttpStatus.BAD_REQUEST,
        })),
      );

      await expect(
        lastValueFrom(controller.runAssessment({}, userClaims as any)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── getRunStatus ──────────────────────────────────────────────────────────

  describe('getRunStatus()', () => {
    it('sends ASSESSMENT_STATUS with runId and returns status', async () => {
      const status = { runId: 'run-1', status: 'completed' };
      simulationService.send.mockReturnValue(of(status));

      const result = await lastValueFrom(controller.getRunStatus('run-1'));

      expect(simulationService.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.ASSESSMENT_STATUS,
        { runId: 'run-1' },
      );
      expect(result).toEqual(status);
    });

    it('throws HttpException when simulation service errors', async () => {
      simulationService.send.mockReturnValue(
        throwError(() => ({
          message: 'status fetch failed',
          status: HttpStatus.NOT_FOUND,
        })),
      );

      await expect(
        lastValueFrom(controller.getRunStatus('run-99')),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── getRunReport ──────────────────────────────────────────────────────────

  describe('getRunReport()', () => {
    it('sends ASSESSMENT_REPORT with runId and returns report', async () => {
      const report = { runId: 'run-1', score: 92, details: [] };
      simulationService.send.mockReturnValue(of(report));

      const result = await lastValueFrom(controller.getRunReport('run-1'));

      expect(simulationService.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.ASSESSMENT_REPORT,
        { runId: 'run-1' },
      );
      expect(result).toEqual(report);
    });

    it('throws HttpException on error', async () => {
      simulationService.send.mockReturnValue(
        throwError(() => new Error('report unavailable')),
      );

      await expect(
        lastValueFrom(controller.getRunReport('run-1')),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── getDashboard ──────────────────────────────────────────────────────────

  describe('getDashboard()', () => {
    it('sends ANALYTICS_DASHBOARD with userId and returns dashboard data', async () => {
      const dashboard = { totalSessions: 10, avgScore: 78 };
      simulationService.send.mockReturnValue(of(dashboard));

      const result = await lastValueFrom(controller.getDashboard('user-123'));

      expect(simulationService.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.ANALYTICS_DASHBOARD,
        { userId: 'user-123' },
      );
      expect(result).toEqual(dashboard);
    });

    it('throws HttpException on error', async () => {
      simulationService.send.mockReturnValue(
        throwError(() => ({
          message: 'dashboard error',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        })),
      );

      await expect(
        lastValueFrom(controller.getDashboard('user-123')),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── getLatest ─────────────────────────────────────────────────────────────

  describe('getLatest()', () => {
    it('sends ASSESSMENT_LATEST with sessionId and optional query params', async () => {
      const latest = { runId: 'run-5', score: 88 };
      simulationService.send.mockReturnValue(of(latest));

      const result = await lastValueFrom(
        controller.getLatest('sess-1', 'iter-1', 'member-1'),
      );

      expect(simulationService.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.ASSESSMENT_LATEST,
        {
          sessionId: 'sess-1',
          iterationId: 'iter-1',
          sessionMemberId: 'member-1',
        },
      );
      expect(result).toEqual(latest);
    });

    it('sends ASSESSMENT_LATEST with undefined optional params when not provided', async () => {
      simulationService.send.mockReturnValue(of({ runId: 'run-6' }));

      await lastValueFrom(controller.getLatest('sess-2'));

      expect(simulationService.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.ASSESSMENT_LATEST,
        {
          sessionId: 'sess-2',
          iterationId: undefined,
          sessionMemberId: undefined,
        },
      );
    });

    it('throws HttpException on error', async () => {
      simulationService.send.mockReturnValue(
        throwError(() => ({
          message: 'not found',
          status: HttpStatus.NOT_FOUND,
        })),
      );

      await expect(
        lastValueFrom(controller.getLatest('sess-1')),
      ).rejects.toThrow(HttpException);
    });
  });
});
