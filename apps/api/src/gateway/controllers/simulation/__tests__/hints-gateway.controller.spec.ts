import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError, lastValueFrom } from 'rxjs';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { HintsGatewayController } from '../hints-gateway.controller';
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
  id: 'user-456',
  email: 'hints@example.com',
  name: 'Hint User',
};

describe('HintsGatewayController', () => {
  let controller: HintsGatewayController;
  let simulationService: ReturnType<typeof createClientProxyMock>;

  beforeEach(async () => {
    simulationService = createClientProxyMock();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HintsGatewayController],
      providers: [
        { provide: 'SIMULATION_SERVICE', useValue: simulationService },
      ],
    })
      .overrideGuard(GlobalJwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideInterceptor(UserClaimsInterceptor)
      .useValue({ intercept: (_: unknown, next: any) => next.handle() })
      .compile();

    controller = module.get(HintsGatewayController);
  });

  afterEach(() => jest.clearAllMocks());

  // ── getHistory ────────────────────────────────────────────────────────────

  describe('getHistory()', () => {
    it('sends HINTS_HISTORY with sessionId and userId, returns hint history', async () => {
      const history = [{ id: 'h-1', text: 'Try again' }];
      simulationService.send.mockReturnValue(of(history));

      const result = await lastValueFrom(
        controller.getHistory(
          'sess-1',
          undefined,
          undefined,
          userClaims as any,
        ),
      );

      expect(simulationService.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.HINTS_HISTORY,
        expect.objectContaining({
          payload: expect.objectContaining({
            sessionId: 'sess-1',
            userId: 'user-456',
            limit: undefined,
            type: undefined,
          }),
          userId: 'user-456',
          sessionId: 'sess-1',
          requestId: expect.stringContaining('hint-history-'),
        }),
      );
      expect(result).toEqual(history);
    });

    it('converts limit string to number when provided', async () => {
      simulationService.send.mockReturnValue(of([]));

      await lastValueFrom(
        controller.getHistory('sess-1', '10', 'coaching', userClaims as any),
      );

      expect(simulationService.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.HINTS_HISTORY,
        expect.objectContaining({
          payload: expect.objectContaining({
            limit: 10,
            type: 'coaching',
          }),
        }),
      );
    });

    it('throws HttpException when simulation service errors', async () => {
      simulationService.send.mockReturnValue(
        throwError(() => ({
          message: 'fetch failed',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        })),
      );

      await expect(
        lastValueFrom(
          controller.getHistory(
            'sess-1',
            undefined,
            undefined,
            userClaims as any,
          ),
        ),
      ).rejects.toThrow(HttpException);
    });

    it('uses INTERNAL_SERVER_ERROR status when error has no status field', async () => {
      simulationService.send.mockReturnValue(
        throwError(() => new Error('generic error')),
      );

      await expect(
        lastValueFrom(
          controller.getHistory(
            'sess-1',
            undefined,
            undefined,
            userClaims as any,
          ),
        ),
      ).rejects.toMatchObject({ status: HttpStatus.INTERNAL_SERVER_ERROR });
    });
  });

  // ── generateHints ─────────────────────────────────────────────────────────

  describe('generateHints()', () => {
    it('sends HINTS_GENERATE with payload merged with userId and sessionId', async () => {
      const payload = { sessionId: 'sess-2', context: 'negotiation' };
      const generated = [
        { id: 'h-2', text: 'Consider the client perspective' },
      ];
      simulationService.send.mockReturnValue(of(generated));

      const result = await lastValueFrom(
        controller.generateHints(payload, userClaims as any),
      );

      expect(simulationService.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.HINTS_GENERATE,
        expect.objectContaining({
          payload: expect.objectContaining({
            sessionId: 'sess-2',
            context: 'negotiation',
            userId: 'user-456',
          }),
          userId: 'user-456',
          sessionId: 'sess-2',
          requestId: expect.stringContaining('hint-generate-'),
        }),
      );
      expect(result).toEqual(generated);
    });

    it('sets sessionId to undefined when payload.sessionId is not a string', async () => {
      const payload = { sessionId: 12345, context: 'sales' };
      simulationService.send.mockReturnValue(of([]));

      await lastValueFrom(
        controller.generateHints(payload as any, userClaims as any),
      );

      expect(simulationService.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.HINTS_GENERATE,
        expect.objectContaining({ sessionId: undefined }),
      );
    });

    it('sets sessionId to undefined when payload has no sessionId', async () => {
      simulationService.send.mockReturnValue(of([]));

      await lastValueFrom(controller.generateHints({}, userClaims as any));

      expect(simulationService.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.HINTS_GENERATE,
        expect.objectContaining({ sessionId: undefined }),
      );
    });

    it('throws HttpException when simulation service errors', async () => {
      simulationService.send.mockReturnValue(
        throwError(() => ({
          message: 'generation failed',
          status: HttpStatus.BAD_REQUEST,
        })),
      );

      await expect(
        lastValueFrom(
          controller.generateHints({ sessionId: 'sess-1' }, userClaims as any),
        ),
      ).rejects.toThrow(HttpException);
    });
  });
});
