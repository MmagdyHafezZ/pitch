import { SessionController } from '../../controllers/session.controller';
import { SessionService } from '../../services/session.service';

jest.mock('@pitch/shared-backend/helpers/exceptions', () => ({
  toRpcException: jest.fn((err: unknown) => err),
}));

import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';

const mockToRpcException = toRpcException as jest.MockedFunction<
  typeof toRpcException
>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeService(): jest.Mocked<SessionService> {
  return {
    create: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    end: jest.fn(),
    restart: jest.fn(),
    remove: jest.fn(),
  } as unknown as jest.Mocked<SessionService>;
}

const USER_CLAIMS = { id: 'user-1', email: 'user@test.com', name: 'Test User' };

const SESSION = { id: 'session-1', status: 'active', userId: 'user-1' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SessionController', () => {
  let controller: SessionController;
  let service: jest.Mocked<SessionService>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = makeService();
    controller = new SessionController(service);
  });

  // -------------------------------------------------------------------------
  // createSession
  // -------------------------------------------------------------------------
  describe('createSession', () => {
    const basePayload = {
      userClaims: USER_CLAIMS,
      scenarioId: 'scenario-1',
      type: 'text',
      userSnapshot: undefined,
    };

    it('should create a session with userClaims.id as userId', async () => {
      service.create.mockResolvedValue(SESSION as any);

      const result = await controller.createSession(basePayload as any);

      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_CLAIMS.id,
          userSnapshot: {
            id: USER_CLAIMS.id,
            email: USER_CLAIMS.email,
            name: USER_CLAIMS.name,
          },
        }),
      );
      expect(result).toEqual(SESSION);
    });

    it('should use explicit userSnapshot if provided in payload', async () => {
      const snapshot = { id: 'user-1', email: 'other@test.com', name: 'Other' };
      const payloadWithSnapshot = { ...basePayload, userSnapshot: snapshot };
      service.create.mockResolvedValue(SESSION as any);

      await controller.createSession(payloadWithSnapshot as any);

      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({ userSnapshot: snapshot }),
      );
    });

    it('should throw wrapped error when userClaims.id is missing', async () => {
      const noIdPayload = { userClaims: { email: 'user@test.com' } };

      await expect(
        controller.createSession(noIdPayload as any),
      ).rejects.toThrow();
      expect(mockToRpcException).toHaveBeenCalled();
    });

    it('should throw wrapped error when userClaims is absent', async () => {
      const noClaimsPayload = { scenarioId: 'scenario-1' };

      await expect(
        controller.createSession(noClaimsPayload as any),
      ).rejects.toThrow();
      expect(mockToRpcException).toHaveBeenCalled();
    });

    it('should wrap service errors with toRpcException', async () => {
      const error = new Error('DB fail');
      service.create.mockRejectedValue(error);

      await expect(
        controller.createSession(basePayload as any),
      ).rejects.toThrow(error);
      expect(mockToRpcException).toHaveBeenCalledWith(error);
    });
  });

  // -------------------------------------------------------------------------
  // getSession
  // -------------------------------------------------------------------------
  describe('getSession', () => {
    const payload = { id: 'session-1', userClaims: USER_CLAIMS };

    it('should call service.findOne with id and userId', async () => {
      service.findOne.mockResolvedValue(SESSION as any);

      const result = await controller.getSession(payload as any);

      expect(service.findOne).toHaveBeenCalledWith('session-1', USER_CLAIMS.id);
      expect(result).toEqual(SESSION);
    });

    it('should pass undefined userId when userClaims is absent', async () => {
      const noClaimsPayload = { id: 'session-1' };
      service.findOne.mockResolvedValue(SESSION as any);

      await controller.getSession(noClaimsPayload as any);

      expect(service.findOne).toHaveBeenCalledWith('session-1', undefined);
    });

    it('should wrap errors with toRpcException', async () => {
      const error = new Error('Not found');
      service.findOne.mockRejectedValue(error);

      await expect(controller.getSession(payload as any)).rejects.toThrow(
        error,
      );
      expect(mockToRpcException).toHaveBeenCalledWith(error);
    });
  });

  // -------------------------------------------------------------------------
  // listSessions
  // -------------------------------------------------------------------------
  describe('listSessions', () => {
    const payload = {
      userClaims: USER_CLAIMS,
      status: 'active',
      page: 1,
      limit: 10,
    };

    it('should call service.findAll with query (sans userClaims) and userId', async () => {
      const list = { sessions: [SESSION], total: 1 };
      service.findAll.mockResolvedValue(list as any);

      const result = await controller.listSessions(payload as any);

      expect(service.findAll).toHaveBeenCalledWith(
        { status: 'active', page: 1, limit: 10 },
        USER_CLAIMS.id,
      );
      expect(result).toEqual(list);
    });

    it('should pass undefined userId when userClaims is absent', async () => {
      const noClaimsPayload = { status: 'active' };
      service.findAll.mockResolvedValue({ sessions: [], total: 0 } as any);

      await controller.listSessions(noClaimsPayload as any);

      expect(service.findAll).toHaveBeenCalledWith(
        { status: 'active' },
        undefined,
      );
    });

    it('should wrap errors with toRpcException', async () => {
      const error = new Error('List failed');
      service.findAll.mockRejectedValue(error);

      await expect(controller.listSessions(payload as any)).rejects.toThrow(
        error,
      );
      expect(mockToRpcException).toHaveBeenCalledWith(error);
    });
  });

  // -------------------------------------------------------------------------
  // updateSession
  // -------------------------------------------------------------------------
  describe('updateSession', () => {
    const payload = {
      id: 'session-1',
      userClaims: USER_CLAIMS,
      status: 'paused',
    };

    it('should call service.update with id, update data, and userId', async () => {
      const updated = { ...SESSION, status: 'paused' };
      service.update.mockResolvedValue(updated as any);

      const result = await controller.updateSession(payload as any);

      expect(service.update).toHaveBeenCalledWith(
        'session-1',
        { status: 'paused' },
        USER_CLAIMS.id,
      );
      expect(result).toEqual(updated);
    });

    it('should pass undefined userId when userClaims is absent', async () => {
      const noClaimsPayload = { id: 'session-1', status: 'paused' };
      service.update.mockResolvedValue(SESSION as any);

      await controller.updateSession(noClaimsPayload as any);

      expect(service.update).toHaveBeenCalledWith(
        'session-1',
        { status: 'paused' },
        undefined,
      );
    });

    it('should wrap errors with toRpcException', async () => {
      const error = new Error('Update failed');
      service.update.mockRejectedValue(error);

      await expect(controller.updateSession(payload as any)).rejects.toThrow(
        error,
      );
      expect(mockToRpcException).toHaveBeenCalledWith(error);
    });
  });

  // -------------------------------------------------------------------------
  // endSession
  // -------------------------------------------------------------------------
  describe('endSession', () => {
    const payload = {
      id: 'session-1',
      userClaims: USER_CLAIMS,
      feedback: 'Great session',
    };

    it('should call service.end with id, end data, and userId', async () => {
      const ended = { ...SESSION, status: 'completed' };
      service.end.mockResolvedValue(ended as any);

      const result = await controller.endSession(payload as any);

      expect(service.end).toHaveBeenCalledWith(
        'session-1',
        { feedback: 'Great session' },
        USER_CLAIMS.id,
      );
      expect(result).toEqual(ended);
    });

    it('should pass undefined userId when userClaims is absent', async () => {
      const noClaimsPayload = { id: 'session-1', feedback: 'ok' };
      service.end.mockResolvedValue(SESSION as any);

      await controller.endSession(noClaimsPayload as any);

      expect(service.end).toHaveBeenCalledWith(
        'session-1',
        { feedback: 'ok' },
        undefined,
      );
    });

    it('should wrap errors with toRpcException', async () => {
      const error = new Error('End failed');
      service.end.mockRejectedValue(error);

      await expect(controller.endSession(payload as any)).rejects.toThrow(
        error,
      );
      expect(mockToRpcException).toHaveBeenCalledWith(error);
    });
  });

  // -------------------------------------------------------------------------
  // restartSession
  // -------------------------------------------------------------------------
  describe('restartSession', () => {
    const payload = {
      id: 'session-1',
      userClaims: USER_CLAIMS,
      keepHistory: false,
    };

    it('should call service.restart with id, restart data, and userId', async () => {
      const restarted = { ...SESSION, status: 'active' };
      service.restart.mockResolvedValue(restarted as any);

      const result = await controller.restartSession(payload as any);

      expect(service.restart).toHaveBeenCalledWith(
        'session-1',
        { keepHistory: false },
        USER_CLAIMS.id,
      );
      expect(result).toEqual(restarted);
    });

    it('should pass undefined userId when userClaims is absent', async () => {
      const noClaimsPayload = { id: 'session-1' };
      service.restart.mockResolvedValue(SESSION as any);

      await controller.restartSession(noClaimsPayload as any);

      expect(service.restart).toHaveBeenCalledWith('session-1', {}, undefined);
    });

    it('should wrap errors with toRpcException', async () => {
      const error = new Error('Restart failed');
      service.restart.mockRejectedValue(error);

      await expect(controller.restartSession(payload as any)).rejects.toThrow(
        error,
      );
      expect(mockToRpcException).toHaveBeenCalledWith(error);
    });
  });

  // -------------------------------------------------------------------------
  // deleteSession
  // -------------------------------------------------------------------------
  describe('deleteSession', () => {
    const payload = {
      id: 'session-1',
      userClaims: USER_CLAIMS,
      isAdmin: false,
    };

    it('should call service.remove with id, userId, and isAdmin flag', async () => {
      service.remove.mockResolvedValue({ message: 'Deleted' } as any);

      const result = await controller.deleteSession(payload as any);

      expect(service.remove).toHaveBeenCalledWith(
        'session-1',
        USER_CLAIMS.id,
        false,
      );
      expect(result).toEqual({ message: 'Deleted' });
    });

    it('should pass isAdmin=true when explicitly set', async () => {
      const adminPayload = { ...payload, isAdmin: true };
      service.remove.mockResolvedValue({} as any);

      await controller.deleteSession(adminPayload as any);

      expect(service.remove).toHaveBeenCalledWith(
        'session-1',
        USER_CLAIMS.id,
        true,
      );
    });

    it('should default isAdmin to false when not supplied', async () => {
      const noAdminPayload = { id: 'session-1', userClaims: USER_CLAIMS };
      service.remove.mockResolvedValue({} as any);

      await controller.deleteSession(noAdminPayload as any);

      expect(service.remove).toHaveBeenCalledWith(
        'session-1',
        USER_CLAIMS.id,
        false,
      );
    });

    it('should pass undefined userId when userClaims is absent', async () => {
      const noClaimsPayload = { id: 'session-1' };
      service.remove.mockResolvedValue({} as any);

      await controller.deleteSession(noClaimsPayload as any);

      expect(service.remove).toHaveBeenCalledWith(
        'session-1',
        undefined,
        false,
      );
    });

    it('should wrap errors with toRpcException', async () => {
      const error = new Error('Delete failed');
      service.remove.mockRejectedValue(error);

      await expect(controller.deleteSession(payload as any)).rejects.toThrow(
        error,
      );
      expect(mockToRpcException).toHaveBeenCalledWith(error);
    });
  });
});
