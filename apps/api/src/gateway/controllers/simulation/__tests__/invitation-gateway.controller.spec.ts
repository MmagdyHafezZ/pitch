import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError, lastValueFrom } from 'rxjs';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { InvitationGatewayController } from '../invitation-gateway.controller';
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
  id: 'inviter-1',
  email: 'inviter@example.com',
  name: 'Inviter User',
};

describe('InvitationGatewayController', () => {
  let controller: InvitationGatewayController;
  let simulationService: ReturnType<typeof createClientProxyMock>;

  beforeEach(async () => {
    simulationService = createClientProxyMock();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvitationGatewayController],
      providers: [
        { provide: 'SIMULATION_SERVICE', useValue: simulationService },
      ],
    })
      .overrideGuard(GlobalJwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideInterceptor(UserClaimsInterceptor)
      .useValue({ intercept: (_: unknown, next: any) => next.handle() })
      .compile();

    controller = module.get(InvitationGatewayController);
  });

  afterEach(() => jest.clearAllMocks());

  // ── createInvitations ─────────────────────────────────────────────────────

  describe('createInvitations()', () => {
    it('sends CREATE_INVITATIONS with sessionId, inviterId, and dto fields', async () => {
      const dto = { emails: ['a@b.com', 'c@d.com'] };
      const response = { created: 2 };
      simulationService.send.mockReturnValue(of(response));

      const result = await lastValueFrom(
        controller.createInvitations('sess-1', dto, userClaims as any),
      );

      expect(simulationService.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.CREATE_INVITATIONS,
        expect.objectContaining({
          sessionId: 'sess-1',
          inviterId: 'inviter-1',
          emails: ['a@b.com', 'c@d.com'],
          userClaims,
        }),
      );
      expect(result).toEqual(response);
    });

    it('throws HttpException on error', async () => {
      simulationService.send.mockReturnValue(
        throwError(() => ({
          message: 'create failed',
          status: HttpStatus.BAD_REQUEST,
        })),
      );

      await expect(
        lastValueFrom(
          controller.createInvitations('sess-1', {}, userClaims as any),
        ),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── listSessionInvitations ────────────────────────────────────────────────

  describe('listSessionInvitations()', () => {
    it('sends LIST_SESSION_INVITATIONS with sessionId and userClaims', async () => {
      const invitations = [{ id: 'inv-1' }, { id: 'inv-2' }];
      simulationService.send.mockReturnValue(of(invitations));

      const result = await lastValueFrom(
        controller.listSessionInvitations('sess-1', userClaims as any),
      );

      expect(simulationService.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.LIST_SESSION_INVITATIONS,
        { sessionId: 'sess-1', userClaims },
      );
      expect(result).toEqual(invitations);
    });

    it('throws HttpException on error', async () => {
      simulationService.send.mockReturnValue(
        throwError(() => new Error('list failed')),
      );

      await expect(
        lastValueFrom(
          controller.listSessionInvitations('sess-1', userClaims as any),
        ),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── getMyInvitations ──────────────────────────────────────────────────────

  describe('getMyInvitations()', () => {
    it('sends LIST_USER_INVITATIONS with userId and optional status', async () => {
      const invitations = [{ id: 'inv-3', status: 'pending' }];
      simulationService.send.mockReturnValue(of(invitations));

      const result = await lastValueFrom(
        controller.getMyInvitations('pending', userClaims as any),
      );

      expect(simulationService.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.LIST_USER_INVITATIONS,
        { userId: 'inviter-1', status: 'pending', userClaims },
      );
      expect(result).toEqual(invitations);
    });

    it('sends LIST_USER_INVITATIONS with undefined status when not provided', async () => {
      simulationService.send.mockReturnValue(of([]));

      await lastValueFrom(
        controller.getMyInvitations(undefined, userClaims as any),
      );

      expect(simulationService.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.LIST_USER_INVITATIONS,
        { userId: 'inviter-1', status: undefined, userClaims },
      );
    });

    it('throws HttpException on error', async () => {
      simulationService.send.mockReturnValue(
        throwError(() => ({
          message: 'forbidden',
          status: HttpStatus.FORBIDDEN,
        })),
      );

      await expect(
        lastValueFrom(
          controller.getMyInvitations(undefined, userClaims as any),
        ),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── getSentInvitations ────────────────────────────────────────────────────

  describe('getSentInvitations()', () => {
    it('sends LIST_SENT_INVITATIONS with userId and optional status', async () => {
      const sent = [{ id: 'inv-4', status: 'accepted' }];
      simulationService.send.mockReturnValue(of(sent));

      const result = await lastValueFrom(
        controller.getSentInvitations('accepted', userClaims as any),
      );

      expect(simulationService.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.LIST_SENT_INVITATIONS,
        { userId: 'inviter-1', status: 'accepted', userClaims },
      );
      expect(result).toEqual(sent);
    });

    it('throws HttpException on error', async () => {
      simulationService.send.mockReturnValue(
        throwError(() => new Error('sent list failed')),
      );

      await expect(
        lastValueFrom(
          controller.getSentInvitations(undefined, userClaims as any),
        ),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── health ────────────────────────────────────────────────────────────────

  describe('health()', () => {
    it('returns ok status without calling simulation service', () => {
      const result = controller.health();

      expect(result).toMatchObject({
        status: 'ok',
        service: 'simulation-invitations',
        timestamp: expect.any(String),
      });
      expect(simulationService.send).not.toHaveBeenCalled();
    });
  });

  // ── getInvitation ─────────────────────────────────────────────────────────

  describe('getInvitation()', () => {
    it('sends GET_INVITATION with id and userClaims', async () => {
      const invitation = { id: 'inv-10', status: 'pending' };
      simulationService.send.mockReturnValue(of(invitation));

      const result = await lastValueFrom(
        controller.getInvitation('inv-10', userClaims as any),
      );

      expect(simulationService.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.GET_INVITATION,
        { id: 'inv-10', userClaims },
      );
      expect(result).toEqual(invitation);
    });

    it('throws HttpException on error', async () => {
      simulationService.send.mockReturnValue(
        throwError(() => ({
          message: 'not found',
          status: HttpStatus.NOT_FOUND,
        })),
      );

      await expect(
        lastValueFrom(controller.getInvitation('inv-99', userClaims as any)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── acceptInvitation ──────────────────────────────────────────────────────

  describe('acceptInvitation()', () => {
    it('sends ACCEPT_INVITATION with id, userId, and userClaims', async () => {
      const response = { accepted: true };
      simulationService.send.mockReturnValue(of(response));

      const result = await lastValueFrom(
        controller.acceptInvitation('inv-10', userClaims as any),
      );

      expect(simulationService.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.ACCEPT_INVITATION,
        { id: 'inv-10', userId: 'inviter-1', userClaims },
      );
      expect(result).toEqual(response);
    });

    it('throws HttpException on error', async () => {
      simulationService.send.mockReturnValue(
        throwError(() => ({
          message: 'already accepted',
          status: HttpStatus.BAD_REQUEST,
        })),
      );

      await expect(
        lastValueFrom(controller.acceptInvitation('inv-10', userClaims as any)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── declineInvitation ─────────────────────────────────────────────────────

  describe('declineInvitation()', () => {
    it('sends DECLINE_INVITATION with id, userId, and userClaims', async () => {
      const response = { declined: true };
      simulationService.send.mockReturnValue(of(response));

      const result = await lastValueFrom(
        controller.declineInvitation('inv-10', userClaims as any),
      );

      expect(simulationService.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.DECLINE_INVITATION,
        { id: 'inv-10', userId: 'inviter-1', userClaims },
      );
      expect(result).toEqual(response);
    });

    it('throws HttpException on error', async () => {
      simulationService.send.mockReturnValue(
        throwError(() => new Error('decline failed')),
      );

      await expect(
        lastValueFrom(
          controller.declineInvitation('inv-10', userClaims as any),
        ),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── revokeInvitation ──────────────────────────────────────────────────────

  describe('revokeInvitation()', () => {
    it('sends REVOKE_INVITATION with id, userId, and userClaims', async () => {
      const response = { revoked: true };
      simulationService.send.mockReturnValue(of(response));

      const result = await lastValueFrom(
        controller.revokeInvitation('inv-10', userClaims as any),
      );

      expect(simulationService.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.REVOKE_INVITATION,
        { id: 'inv-10', userId: 'inviter-1', userClaims },
      );
      expect(result).toEqual(response);
    });

    it('throws HttpException when permission is denied', async () => {
      simulationService.send.mockReturnValue(
        throwError(() => ({
          message: 'permission denied',
          status: HttpStatus.FORBIDDEN,
        })),
      );

      await expect(
        lastValueFrom(controller.revokeInvitation('inv-10', userClaims as any)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── getPendingCount ───────────────────────────────────────────────────────

  describe('getPendingCount()', () => {
    it('sends GET_PENDING_COUNT with userId and userClaims, returns count', async () => {
      const response = { count: 3 };
      simulationService.send.mockReturnValue(of(response));

      const result = await lastValueFrom(
        controller.getPendingCount(userClaims as any),
      );

      expect(simulationService.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.GET_PENDING_COUNT,
        { userId: 'inviter-1', userClaims },
      );
      expect(result).toEqual(response);
    });

    it('throws HttpException on error', async () => {
      simulationService.send.mockReturnValue(
        throwError(() => new Error('count failed')),
      );

      await expect(
        lastValueFrom(controller.getPendingCount(userClaims as any)),
      ).rejects.toThrow(HttpException);
    });
  });
});
