import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SessionHttpController } from '../../controllers/session-http.controller';
import { SessionService } from '../../services/session.service';
import { SessionMemberService } from '../../services/session-member.service';

// ---------------------------------------------------------------------------
// Helpers / shared fixtures
// ---------------------------------------------------------------------------

const mockSession = {
  id: 'session-1',
  orgId: 'org-1',
  status: 'active',
  type: 'text',
  scenarioId: 'scenario-1',
  personaId: 'persona-1',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockSessionList = {
  sessions: [mockSession],
  total: 1,
};

const mockDeleteResponse = { deleted: true, id: 'session-1' };

const mockMember = {
  id: 'member-1',
  sessionId: 'session-1',
  userId: 'user-1',
  role: 'viewer',
};

const mockMemberList = { members: [mockMember], total: 1 };

const mockBulkAddResponse = { added: [mockMember], failed: [] };

const mockRemoveResponse = { removed: true, userId: 'user-1' };

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

const mockSessionService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  end: jest.fn(),
  restart: jest.fn(),
  remove: jest.fn(),
  findActiveByUserId: jest.fn(),
  findActiveByOrgId: jest.fn(),
};

const mockSessionMemberService = {
  addMembers: jest.fn(),
  listMembers: jest.fn(),
  removeMember: jest.fn(),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('SessionHttpController', () => {
  let controller: SessionHttpController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionHttpController],
      providers: [
        { provide: SessionService, useValue: mockSessionService },
        { provide: SessionMemberService, useValue: mockSessionMemberService },
      ],
    }).compile();

    controller = module.get<SessionHttpController>(SessionHttpController);
  });

  // -------------------------------------------------------------------------
  // health
  // -------------------------------------------------------------------------
  describe('health', () => {
    it('returns status ok with service name and ISO timestamp', () => {
      const result = controller.health();

      expect(result.status).toBe('ok');
      expect(result.service).toBe('simulation-sessions');
      expect(typeof result.timestamp).toBe('string');
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });
  });

  // -------------------------------------------------------------------------
  // createSession
  // -------------------------------------------------------------------------
  describe('createSession', () => {
    const createDto = {
      orgId: 'org-1',
      type: 'text',
      scenarioId: 'scenario-1',
    } as any;

    it('creates a session with the provided userId query param', async () => {
      mockSessionService.create.mockResolvedValue(mockSession);

      const result = await controller.createSession(createDto, 'user-42');

      expect(mockSessionService.create).toHaveBeenCalledWith(
        createDto,
        'user-42',
      );
      expect(result).toEqual(mockSession);
    });

    it('falls back to "test-user-http-endpoint" when userId is not provided', async () => {
      mockSessionService.create.mockResolvedValue(mockSession);

      await controller.createSession(createDto, undefined);

      expect(mockSessionService.create).toHaveBeenCalledWith(
        createDto,
        'test-user-http-endpoint',
      );
    });

    it('propagates errors thrown by SessionService', async () => {
      const error = new BadRequestException('Invalid data');
      mockSessionService.create.mockRejectedValue(error);

      await expect(
        controller.createSession(createDto, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // listSessions
  // -------------------------------------------------------------------------
  describe('listSessions', () => {
    const query = { limit: 10, offset: 0 } as any;

    it('lists sessions and returns them with total', async () => {
      mockSessionService.findAll.mockResolvedValue(mockSessionList);

      const result = await controller.listSessions(query, 'user-1');

      expect(mockSessionService.findAll).toHaveBeenCalledWith(query, 'user-1');
      expect(result).toEqual(mockSessionList);
    });

    it('passes undefined userId when not provided', async () => {
      mockSessionService.findAll.mockResolvedValue(mockSessionList);

      await controller.listSessions(query, undefined);

      expect(mockSessionService.findAll).toHaveBeenCalledWith(query, undefined);
    });

    it('propagates errors from SessionService', async () => {
      mockSessionService.findAll.mockRejectedValue(new Error('DB error'));

      await expect(controller.listSessions(query)).rejects.toThrow('DB error');
    });
  });

  // -------------------------------------------------------------------------
  // getSession
  // -------------------------------------------------------------------------
  describe('getSession', () => {
    it('returns the session when found', async () => {
      mockSessionService.findOne.mockResolvedValue(mockSession);

      const result = await controller.getSession('session-1');

      expect(mockSessionService.findOne).toHaveBeenCalledWith('session-1');
      expect(result).toEqual(mockSession);
    });

    it('propagates NotFoundException when session is missing', async () => {
      mockSessionService.findOne.mockRejectedValue(
        new NotFoundException('Session not found'),
      );

      await expect(controller.getSession('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('propagates generic errors', async () => {
      mockSessionService.findOne.mockRejectedValue(new Error('Unexpected'));

      await expect(controller.getSession('session-1')).rejects.toThrow(
        'Unexpected',
      );
    });
  });

  // -------------------------------------------------------------------------
  // updateSession
  // -------------------------------------------------------------------------
  describe('updateSession', () => {
    const updateDto = { status: 'paused' } as any;

    it('updates a session and returns the updated entity', async () => {
      const updated = { ...mockSession, status: 'paused' };
      mockSessionService.update.mockResolvedValue(updated);

      const result = await controller.updateSession(
        'session-1',
        updateDto,
        'user-1',
      );

      expect(mockSessionService.update).toHaveBeenCalledWith(
        'session-1',
        updateDto,
        'user-1',
      );
      expect(result).toEqual(updated);
    });

    it('falls back to "test-user-http-endpoint" when userId omitted', async () => {
      mockSessionService.update.mockResolvedValue(mockSession);

      await controller.updateSession('session-1', updateDto, undefined);

      expect(mockSessionService.update).toHaveBeenCalledWith(
        'session-1',
        updateDto,
        'test-user-http-endpoint',
      );
    });

    it('propagates NotFoundException', async () => {
      mockSessionService.update.mockRejectedValue(
        new NotFoundException('Session not found'),
      );

      await expect(
        controller.updateSession('bad-id', updateDto, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates BadRequestException', async () => {
      mockSessionService.update.mockRejectedValue(
        new BadRequestException('Session already ended'),
      );

      await expect(
        controller.updateSession('session-1', updateDto, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // endSession
  // -------------------------------------------------------------------------
  describe('endSession', () => {
    const endDto = { reason: 'completed' } as any;

    it('ends a session with provided userId', async () => {
      const ended = { ...mockSession, status: 'ended' };
      mockSessionService.end.mockResolvedValue(ended);

      const result = await controller.endSession('session-1', endDto, 'user-1');

      expect(mockSessionService.end).toHaveBeenCalledWith(
        'session-1',
        endDto,
        'user-1',
      );
      expect(result).toEqual(ended);
    });

    it('uses default userId when not provided', async () => {
      mockSessionService.end.mockResolvedValue(mockSession);

      await controller.endSession('session-1', endDto, undefined);

      expect(mockSessionService.end).toHaveBeenCalledWith(
        'session-1',
        endDto,
        'test-user-http-endpoint',
      );
    });

    it('propagates NotFoundException', async () => {
      mockSessionService.end.mockRejectedValue(
        new NotFoundException('Session not found'),
      );

      await expect(
        controller.endSession('bad-id', endDto, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates BadRequestException when session already ended', async () => {
      mockSessionService.end.mockRejectedValue(
        new BadRequestException('Session already ended'),
      );

      await expect(
        controller.endSession('session-1', endDto, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // restartSession
  // -------------------------------------------------------------------------
  describe('restartSession', () => {
    const restartDto = { reason: 'retry' } as any;

    it('restarts a session with provided userId', async () => {
      const restarted = { ...mockSession, status: 'active' };
      mockSessionService.restart.mockResolvedValue(restarted);

      const result = await controller.restartSession(
        'session-1',
        restartDto,
        'user-1',
      );

      expect(mockSessionService.restart).toHaveBeenCalledWith(
        'session-1',
        restartDto,
        'user-1',
      );
      expect(result).toEqual(restarted);
    });

    it('uses default userId when omitted', async () => {
      mockSessionService.restart.mockResolvedValue(mockSession);

      await controller.restartSession('session-1', restartDto, undefined);

      expect(mockSessionService.restart).toHaveBeenCalledWith(
        'session-1',
        restartDto,
        'test-user-http-endpoint',
      );
    });

    it('propagates NotFoundException', async () => {
      mockSessionService.restart.mockRejectedValue(
        new NotFoundException('Session not found'),
      );

      await expect(
        controller.restartSession('bad-id', restartDto, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates BadRequestException', async () => {
      mockSessionService.restart.mockRejectedValue(
        new BadRequestException('Cannot restart'),
      );

      await expect(
        controller.restartSession('session-1', restartDto, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // deleteSession
  // -------------------------------------------------------------------------
  describe('deleteSession', () => {
    it('deletes a session and returns delete response', async () => {
      mockSessionService.remove.mockResolvedValue(mockDeleteResponse);

      const result = await controller.deleteSession('session-1', 'user-1');

      expect(mockSessionService.remove).toHaveBeenCalledWith(
        'session-1',
        'user-1',
      );
      expect(result).toEqual(mockDeleteResponse);
    });

    it('uses default userId when not provided', async () => {
      mockSessionService.remove.mockResolvedValue(mockDeleteResponse);

      await controller.deleteSession('session-1', undefined);

      expect(mockSessionService.remove).toHaveBeenCalledWith(
        'session-1',
        'test-user-http-endpoint',
      );
    });

    it('propagates NotFoundException', async () => {
      mockSessionService.remove.mockRejectedValue(
        new NotFoundException('Session not found'),
      );

      await expect(
        controller.deleteSession('bad-id', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // addSessionMembers
  // -------------------------------------------------------------------------
  describe('addSessionMembers', () => {
    const payload = { userIds: ['user-1', 'user-2'] } as any;

    it('adds members to a session', async () => {
      mockSessionMemberService.addMembers.mockResolvedValue(
        mockBulkAddResponse,
      );

      const result = await controller.addSessionMembers(
        'session-1',
        payload,
        'user-admin',
      );

      expect(mockSessionMemberService.addMembers).toHaveBeenCalledWith(
        'session-1',
        'user-admin',
        payload,
      );
      expect(result).toEqual(mockBulkAddResponse);
    });

    it('uses default requesterId when userId omitted', async () => {
      mockSessionMemberService.addMembers.mockResolvedValue(
        mockBulkAddResponse,
      );

      await controller.addSessionMembers('session-1', payload, undefined);

      expect(mockSessionMemberService.addMembers).toHaveBeenCalledWith(
        'session-1',
        'test-user-http-endpoint',
        payload,
      );
    });

    it('propagates errors from SessionMemberService', async () => {
      mockSessionMemberService.addMembers.mockRejectedValue(
        new BadRequestException('Invalid members'),
      );

      await expect(
        controller.addSessionMembers('session-1', payload, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // listSessionMembers
  // -------------------------------------------------------------------------
  describe('listSessionMembers', () => {
    it('lists members of a session', async () => {
      mockSessionMemberService.listMembers.mockResolvedValue(mockMemberList);

      const result = await controller.listSessionMembers('session-1', 'user-1');

      expect(mockSessionMemberService.listMembers).toHaveBeenCalledWith(
        'session-1',
        'user-1',
      );
      expect(result).toEqual(mockMemberList);
    });

    it('uses default requesterId when userId omitted', async () => {
      mockSessionMemberService.listMembers.mockResolvedValue(mockMemberList);

      await controller.listSessionMembers('session-1', undefined);

      expect(mockSessionMemberService.listMembers).toHaveBeenCalledWith(
        'session-1',
        'test-user-http-endpoint',
      );
    });

    it('propagates errors from SessionMemberService', async () => {
      mockSessionMemberService.listMembers.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(
        controller.listSessionMembers('session-1', 'user-1'),
      ).rejects.toThrow('DB error');
    });
  });

  // -------------------------------------------------------------------------
  // removeSessionMember
  // -------------------------------------------------------------------------
  describe('removeSessionMember', () => {
    it('removes a member from a session', async () => {
      mockSessionMemberService.removeMember.mockResolvedValue(
        mockRemoveResponse,
      );

      const result = await controller.removeSessionMember(
        'session-1',
        'user-1',
        'admin-user',
      );

      expect(mockSessionMemberService.removeMember).toHaveBeenCalledWith(
        'session-1',
        'admin-user',
        'user-1',
      );
      expect(result).toEqual(mockRemoveResponse);
    });

    it('uses default requesterId when userId omitted', async () => {
      mockSessionMemberService.removeMember.mockResolvedValue(
        mockRemoveResponse,
      );

      await controller.removeSessionMember('session-1', 'user-1', undefined);

      expect(mockSessionMemberService.removeMember).toHaveBeenCalledWith(
        'session-1',
        'test-user-http-endpoint',
        'user-1',
      );
    });

    it('propagates errors from SessionMemberService', async () => {
      mockSessionMemberService.removeMember.mockRejectedValue(
        new NotFoundException('Member not found'),
      );

      await expect(
        controller.removeSessionMember('session-1', 'user-1', 'admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // getActiveUserSessions
  // -------------------------------------------------------------------------
  describe('getActiveUserSessions', () => {
    it('returns active sessions for a user', async () => {
      const activeSessions = [mockSession];
      mockSessionService.findActiveByUserId.mockResolvedValue(activeSessions);

      const result = await controller.getActiveUserSessions('user-1');

      expect(mockSessionService.findActiveByUserId).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual(activeSessions);
    });

    it('returns an empty array when no active sessions', async () => {
      mockSessionService.findActiveByUserId.mockResolvedValue([]);

      const result = await controller.getActiveUserSessions('user-no-sessions');

      expect(result).toEqual([]);
    });

    it('propagates errors', async () => {
      mockSessionService.findActiveByUserId.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(controller.getActiveUserSessions('user-1')).rejects.toThrow(
        'DB error',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getActiveOrgSessions
  // -------------------------------------------------------------------------
  describe('getActiveOrgSessions', () => {
    it('returns active sessions for an organization', async () => {
      const activeSessions = [mockSession];
      mockSessionService.findActiveByOrgId.mockResolvedValue(activeSessions);

      const result = await controller.getActiveOrgSessions('org-1');

      expect(mockSessionService.findActiveByOrgId).toHaveBeenCalledWith(
        'org-1',
      );
      expect(result).toEqual(activeSessions);
    });

    it('returns an empty array when no active sessions', async () => {
      mockSessionService.findActiveByOrgId.mockResolvedValue([]);

      const result = await controller.getActiveOrgSessions('org-no-sessions');

      expect(result).toEqual([]);
    });

    it('propagates errors', async () => {
      mockSessionService.findActiveByOrgId.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(controller.getActiveOrgSessions('org-1')).rejects.toThrow(
        'DB error',
      );
    });
  });
});
