import { InvitationController } from '../../controllers/invitation.controller';
import { InvitationService } from '../../services/invitation.service';
import { InvitationStatus } from '../../dto/invitation.dto';

// Mock the toRpcException helper so we can assert on it without importing the real module
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

function makeService(): jest.Mocked<InvitationService> {
  return {
    createInvitations: jest.fn(),
    findOne: jest.fn(),
    findBySessionId: jest.fn(),
    findInvitationsForUser: jest.fn(),
    findInvitationsSentByUser: jest.fn(),
    acceptInvitation: jest.fn(),
    declineInvitation: jest.fn(),
    revokeInvitation: jest.fn(),
    deleteInvitation: jest.fn(),
    getPendingCount: jest.fn(),
  } as unknown as jest.Mocked<InvitationService>;
}

const USER_CLAIMS = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'User One',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InvitationController', () => {
  let controller: InvitationController;
  let service: jest.Mocked<InvitationService>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = makeService();
    controller = new InvitationController(service);
  });

  // -------------------------------------------------------------------------
  // createInvitations
  // -------------------------------------------------------------------------
  describe('createInvitations', () => {
    const payload = {
      sessionId: 'session-1',
      inviterId: 'fallback-inviter',
      inviteeIds: ['user-2', 'user-3'],
      message: 'Come join!',
      userClaims: USER_CLAIMS,
    };

    it('should call service.createInvitations with correct args and return result', async () => {
      const result = { invitations: [], created: 2, failed: 0 };
      service.createInvitations.mockResolvedValue(result as any);

      const response = await controller.createInvitations(payload as any);

      // The controller spreads the payload after destructuring sessionId + userClaims.
      // inviterId is part of the spread but CreateInvitationDto only carries inviteeIds/message.
      expect(service.createInvitations).toHaveBeenCalledWith(
        'session-1',
        USER_CLAIMS.id, // prefers userClaims.id over inviterId
        expect.objectContaining({
          inviteeIds: ['user-2', 'user-3'],
          message: 'Come join!',
        }),
      );
      expect(response).toEqual(result);
    });

    it('should fall back to data.inviterId when userClaims.id is absent', async () => {
      const noClaimsPayload = { ...payload, userClaims: undefined };
      service.createInvitations.mockResolvedValue([] as any);

      await controller.createInvitations(noClaimsPayload as any);

      expect(service.createInvitations).toHaveBeenCalledWith(
        'session-1',
        'fallback-inviter',
        expect.any(Object),
      );
    });

    it('should wrap errors with toRpcException and rethrow', async () => {
      const error = new Error('DB error');
      service.createInvitations.mockRejectedValue(error);

      await expect(
        controller.createInvitations(payload as any),
      ).rejects.toThrow(error);
      expect(mockToRpcException).toHaveBeenCalledWith(error);
    });
  });

  // -------------------------------------------------------------------------
  // getInvitation
  // -------------------------------------------------------------------------
  describe('getInvitation', () => {
    const payload = { id: 'inv-1', userClaims: USER_CLAIMS };

    it('should call service.findOne and return result', async () => {
      const invitation = { id: 'inv-1', status: InvitationStatus.pending };
      service.findOne.mockResolvedValue(invitation as any);

      const result = await controller.getInvitation(payload as any);

      expect(service.findOne).toHaveBeenCalledWith('inv-1');
      expect(result).toEqual(invitation);
    });

    it('should handle missing userClaims gracefully (logs "unknown")', async () => {
      const noClaimsPayload = { id: 'inv-1' };
      service.findOne.mockResolvedValue({ id: 'inv-1' } as any);

      await controller.getInvitation(noClaimsPayload as any);

      expect(service.findOne).toHaveBeenCalledWith('inv-1');
    });

    it('should wrap errors with toRpcException and rethrow', async () => {
      const error = new Error('Not found');
      service.findOne.mockRejectedValue(error);

      await expect(controller.getInvitation(payload as any)).rejects.toThrow(
        error,
      );
      expect(mockToRpcException).toHaveBeenCalledWith(error);
    });
  });

  // -------------------------------------------------------------------------
  // listSessionInvitations
  // -------------------------------------------------------------------------
  describe('listSessionInvitations', () => {
    const payload = { sessionId: 'session-1', userClaims: USER_CLAIMS };

    it('should call service.findBySessionId and return result', async () => {
      const list = { invitations: [], total: 0 };
      service.findBySessionId.mockResolvedValue(list as any);

      const result = await controller.listSessionInvitations(payload as any);

      expect(service.findBySessionId).toHaveBeenCalledWith('session-1');
      expect(result).toEqual(list);
    });

    it('should wrap errors with toRpcException and rethrow', async () => {
      const error = new Error('Fail');
      service.findBySessionId.mockRejectedValue(error);

      await expect(
        controller.listSessionInvitations(payload as any),
      ).rejects.toThrow(error);
      expect(mockToRpcException).toHaveBeenCalledWith(error);
    });
  });

  // -------------------------------------------------------------------------
  // listUserInvitations
  // -------------------------------------------------------------------------
  describe('listUserInvitations', () => {
    const payload = {
      userId: 'user-fallback',
      status: InvitationStatus.pending,
      userClaims: USER_CLAIMS,
    };

    it('should prefer userClaims.id as requesterId', async () => {
      service.findInvitationsForUser.mockResolvedValue({
        invitations: [],
        total: 0,
      } as any);

      await controller.listUserInvitations(payload as any);

      expect(service.findInvitationsForUser).toHaveBeenCalledWith(
        USER_CLAIMS.id,
        InvitationStatus.pending,
      );
    });

    it('should fall back to data.userId when userClaims is absent', async () => {
      const noClaimsPayload = {
        userId: 'user-fallback',
        status: InvitationStatus.accepted,
      };
      service.findInvitationsForUser.mockResolvedValue({
        invitations: [],
        total: 0,
      } as any);

      await controller.listUserInvitations(noClaimsPayload as any);

      expect(service.findInvitationsForUser).toHaveBeenCalledWith(
        'user-fallback',
        InvitationStatus.accepted,
      );
    });

    it('should wrap errors with toRpcException and rethrow', async () => {
      const error = new Error('Service failure');
      service.findInvitationsForUser.mockRejectedValue(error);

      await expect(
        controller.listUserInvitations(payload as any),
      ).rejects.toThrow(error);
      expect(mockToRpcException).toHaveBeenCalledWith(error);
    });
  });

  // -------------------------------------------------------------------------
  // listSentInvitations
  // -------------------------------------------------------------------------
  describe('listSentInvitations', () => {
    const payload = {
      userId: 'user-fallback',
      status: InvitationStatus.revoked,
      userClaims: USER_CLAIMS,
    };

    it('should prefer userClaims.id as requesterId', async () => {
      service.findInvitationsSentByUser.mockResolvedValue({
        invitations: [],
        total: 0,
      } as any);

      await controller.listSentInvitations(payload as any);

      expect(service.findInvitationsSentByUser).toHaveBeenCalledWith(
        USER_CLAIMS.id,
        InvitationStatus.revoked,
      );
    });

    it('should fall back to data.userId when userClaims is absent', async () => {
      const noClaimsPayload = { userId: 'user-fallback' };
      service.findInvitationsSentByUser.mockResolvedValue({
        invitations: [],
        total: 0,
      } as any);

      await controller.listSentInvitations(noClaimsPayload as any);

      expect(service.findInvitationsSentByUser).toHaveBeenCalledWith(
        'user-fallback',
        undefined,
      );
    });

    it('should wrap errors with toRpcException and rethrow', async () => {
      const error = new Error('Fail');
      service.findInvitationsSentByUser.mockRejectedValue(error);

      await expect(
        controller.listSentInvitations(payload as any),
      ).rejects.toThrow(error);
      expect(mockToRpcException).toHaveBeenCalledWith(error);
    });
  });

  // -------------------------------------------------------------------------
  // acceptInvitation
  // -------------------------------------------------------------------------
  describe('acceptInvitation', () => {
    const payload = {
      id: 'inv-1',
      userId: 'fallback-user',
      userClaims: USER_CLAIMS,
    };

    it('should call service.acceptInvitation with correct args', async () => {
      const accepted = { id: 'inv-1', status: InvitationStatus.accepted };
      service.acceptInvitation.mockResolvedValue(accepted as any);

      const result = await controller.acceptInvitation(payload as any);

      expect(service.acceptInvitation).toHaveBeenCalledWith(
        'inv-1',
        USER_CLAIMS.id,
      );
      expect(result).toEqual(accepted);
    });

    it('should fall back to data.userId when userClaims is absent', async () => {
      const noClaimsPayload = { id: 'inv-1', userId: 'fallback-user' };
      service.acceptInvitation.mockResolvedValue({} as any);

      await controller.acceptInvitation(noClaimsPayload as any);

      expect(service.acceptInvitation).toHaveBeenCalledWith(
        'inv-1',
        'fallback-user',
      );
    });

    it('should wrap errors with toRpcException and rethrow', async () => {
      const error = new Error('Cannot accept');
      service.acceptInvitation.mockRejectedValue(error);

      await expect(controller.acceptInvitation(payload as any)).rejects.toThrow(
        error,
      );
      expect(mockToRpcException).toHaveBeenCalledWith(error);
    });
  });

  // -------------------------------------------------------------------------
  // declineInvitation
  // -------------------------------------------------------------------------
  describe('declineInvitation', () => {
    const payload = {
      id: 'inv-1',
      userId: 'fallback-user',
      userClaims: USER_CLAIMS,
    };

    it('should call service.declineInvitation with correct args', async () => {
      const declined = { id: 'inv-1', status: InvitationStatus.declined };
      service.declineInvitation.mockResolvedValue(declined as any);

      const result = await controller.declineInvitation(payload as any);

      expect(service.declineInvitation).toHaveBeenCalledWith(
        'inv-1',
        USER_CLAIMS.id,
      );
      expect(result).toEqual(declined);
    });

    it('should fall back to data.userId when userClaims is absent', async () => {
      const noClaimsPayload = { id: 'inv-1', userId: 'fallback-user' };
      service.declineInvitation.mockResolvedValue({} as any);

      await controller.declineInvitation(noClaimsPayload as any);

      expect(service.declineInvitation).toHaveBeenCalledWith(
        'inv-1',
        'fallback-user',
      );
    });

    it('should wrap errors with toRpcException and rethrow', async () => {
      const error = new Error('Cannot decline');
      service.declineInvitation.mockRejectedValue(error);

      await expect(
        controller.declineInvitation(payload as any),
      ).rejects.toThrow(error);
      expect(mockToRpcException).toHaveBeenCalledWith(error);
    });
  });

  // -------------------------------------------------------------------------
  // revokeInvitation
  // -------------------------------------------------------------------------
  describe('revokeInvitation', () => {
    const payload = {
      id: 'inv-1',
      userId: 'fallback-user',
      userClaims: USER_CLAIMS,
    };

    it('should call service.revokeInvitation with correct args', async () => {
      const revoked = { id: 'inv-1', status: InvitationStatus.revoked };
      service.revokeInvitation.mockResolvedValue(revoked as any);

      const result = await controller.revokeInvitation(payload as any);

      expect(service.revokeInvitation).toHaveBeenCalledWith(
        'inv-1',
        USER_CLAIMS.id,
      );
      expect(result).toEqual(revoked);
    });

    it('should fall back to data.userId when userClaims is absent', async () => {
      const noClaimsPayload = { id: 'inv-1', userId: 'fallback-user' };
      service.revokeInvitation.mockResolvedValue({} as any);

      await controller.revokeInvitation(noClaimsPayload as any);

      expect(service.revokeInvitation).toHaveBeenCalledWith(
        'inv-1',
        'fallback-user',
      );
    });

    it('should wrap errors with toRpcException and rethrow', async () => {
      const error = new Error('Cannot revoke');
      service.revokeInvitation.mockRejectedValue(error);

      await expect(controller.revokeInvitation(payload as any)).rejects.toThrow(
        error,
      );
      expect(mockToRpcException).toHaveBeenCalledWith(error);
    });
  });

  // -------------------------------------------------------------------------
  // deleteInvitation
  // -------------------------------------------------------------------------
  describe('deleteInvitation', () => {
    const payload = { id: 'inv-1', userClaims: USER_CLAIMS };

    it('should call service.deleteInvitation and return result', async () => {
      const deleted = { message: 'Deleted', id: 'inv-1' };
      service.deleteInvitation.mockResolvedValue(deleted as any);

      const result = await controller.deleteInvitation(payload as any);

      expect(service.deleteInvitation).toHaveBeenCalledWith('inv-1');
      expect(result).toEqual(deleted);
    });

    it('should wrap errors with toRpcException and rethrow', async () => {
      const error = new Error('Delete failed');
      service.deleteInvitation.mockRejectedValue(error);

      await expect(controller.deleteInvitation(payload as any)).rejects.toThrow(
        error,
      );
      expect(mockToRpcException).toHaveBeenCalledWith(error);
    });
  });

  // -------------------------------------------------------------------------
  // getPendingCount
  // -------------------------------------------------------------------------
  describe('getPendingCount', () => {
    const payload = { userId: 'fallback-user', userClaims: USER_CLAIMS };

    it('should prefer userClaims.id and return count', async () => {
      service.getPendingCount.mockResolvedValue(5 as any);

      const result = await controller.getPendingCount(payload as any);

      expect(service.getPendingCount).toHaveBeenCalledWith(USER_CLAIMS.id);
      expect(result).toBe(5);
    });

    it('should fall back to data.userId when userClaims is absent', async () => {
      const noClaimsPayload = { userId: 'fallback-user' };
      service.getPendingCount.mockResolvedValue(3 as any);

      await controller.getPendingCount(noClaimsPayload as any);

      expect(service.getPendingCount).toHaveBeenCalledWith('fallback-user');
    });

    it('should wrap errors with toRpcException and rethrow', async () => {
      const error = new Error('Count failed');
      service.getPendingCount.mockRejectedValue(error);

      await expect(controller.getPendingCount(payload as any)).rejects.toThrow(
        error,
      );
      expect(mockToRpcException).toHaveBeenCalledWith(error);
    });
  });
});
