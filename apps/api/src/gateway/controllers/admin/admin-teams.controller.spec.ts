import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { of, throwError, firstValueFrom } from 'rxjs';
import { AdminTeamsController } from './admin-teams.controller';
import { CheckSystemAdmin } from '../../guards/check-system-admin.guard';
import { JwtService } from '@nestjs/jwt';
import type { UserClaims } from '@pitch/shared-backend/interfaces/user-claims.interface';

function makeClientProxy(sendResult: unknown = { status: 'ok' }) {
  return {
    send: jest.fn().mockReturnValue(of(sendResult)),
  };
}

const mockUserClaims: UserClaims = {
  id: 'admin-1',
  email: 'admin@test.com',
  name: 'Admin',
};

describe('AdminTeamsController', () => {
  let controller: AdminTeamsController;
  let userService: ReturnType<typeof makeClientProxy>;

  beforeEach(async () => {
    userService = makeClientProxy();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminTeamsController],
      providers: [
        CheckSystemAdmin,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn().mockReturnValue({ email: 'admin@test.com' }),
          },
        },
        { provide: 'USER_SERVICE', useValue: userService },
      ],
    }).compile();

    controller = module.get<AdminTeamsController>(AdminTeamsController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('listTeams()', () => {
    it('sends GET_TEAMS with default limit/offset', async () => {
      const teams = [{ id: 't1' }];
      userService.send.mockReturnValue(of(teams));

      const result = await firstValueFrom(
        controller.listTeams(undefined, undefined, undefined, mockUserClaims),
      );

      expect(userService.send).toHaveBeenCalledWith('get_teams', {
        limit: 50,
        offset: 0,
        search: undefined,
        isAdmin: true,
        userClaims: mockUserClaims,
      });
      expect(result).toEqual(teams);
    });

    it('parses limit, offset, and search from strings', async () => {
      userService.send.mockReturnValue(of([]));

      await firstValueFrom(
        controller.listTeams('10', '5', 'acme', mockUserClaims),
      );

      expect(userService.send).toHaveBeenCalledWith('get_teams', {
        limit: 10,
        offset: 5,
        search: 'acme',
        isAdmin: true,
        userClaims: mockUserClaims,
      });
    });

    it('throws HttpException on service error', async () => {
      userService.send.mockReturnValue(
        throwError(() => ({ message: 'DB error', status: 500 })),
      );

      await expect(firstValueFrom(controller.listTeams())).rejects.toThrow(
        HttpException,
      );
    });

    it('uses default error message when none provided', async () => {
      userService.send.mockReturnValue(throwError(() => ({})));

      try {
        await firstValueFrom(controller.listTeams());
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).message).toBe('Failed to list teams');
      }
    });
  });

  describe('getTeam()', () => {
    it('sends GET_TEAM with teamId', async () => {
      const team = { id: 't1', name: 'Acme' };
      userService.send.mockReturnValue(of(team));

      const result = await firstValueFrom(
        controller.getTeam('t1', mockUserClaims),
      );

      expect(userService.send).toHaveBeenCalledWith('get_team', {
        teamId: 't1',
        isAdmin: true,
        userClaims: mockUserClaims,
      });
      expect(result).toEqual(team);
    });

    it('throws HttpException when team not found', async () => {
      userService.send.mockReturnValue(
        throwError(() => ({ message: 'Not found', status: 404 })),
      );

      try {
        await firstValueFrom(controller.getTeam('bad-id', mockUserClaims));
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(404);
      }
    });
  });

  describe('updateTeam()', () => {
    it('sends UPDATE_TEAM with teamId, body, and isAdmin', async () => {
      const updated = { id: 't1', name: 'New Name' };
      userService.send.mockReturnValue(of(updated));

      const result = await firstValueFrom(
        controller.updateTeam('t1', { name: 'New Name' }, mockUserClaims),
      );

      expect(userService.send).toHaveBeenCalledWith('update_team', {
        teamId: 't1',
        name: 'New Name',
        isAdmin: true,
        userClaims: mockUserClaims,
      });
      expect(result).toEqual(updated);
    });

    it('throws HttpException on validation error', async () => {
      userService.send.mockReturnValue(
        throwError(() => ({ message: 'Invalid', status: 400 })),
      );

      try {
        await firstValueFrom(
          controller.updateTeam('t1', { name: '' }, mockUserClaims),
        );
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(400);
      }
    });
  });

  describe('deleteTeam()', () => {
    it('sends DELETE_TEAM with teamId', async () => {
      userService.send.mockReturnValue(of({ deleted: true }));

      const result = await firstValueFrom(
        controller.deleteTeam('t1', mockUserClaims),
      );

      expect(userService.send).toHaveBeenCalledWith('delete_team', {
        teamId: 't1',
        isAdmin: true,
        userClaims: mockUserClaims,
      });
      expect(result).toEqual({ deleted: true });
    });

    it('throws HttpException on error', async () => {
      userService.send.mockReturnValue(
        throwError(() => ({ message: 'Forbidden', status: 403 })),
      );

      await expect(
        firstValueFrom(controller.deleteTeam('t1', mockUserClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getTeamMembers()', () => {
    it('sends GET_TEAM with includeMembers flag', async () => {
      const teamWithMembers = {
        id: 't1',
        members: [{ id: 'u1' }, { id: 'u2' }],
      };
      userService.send.mockReturnValue(of(teamWithMembers));

      const result = await firstValueFrom(
        controller.getTeamMembers('t1', mockUserClaims),
      );

      expect(userService.send).toHaveBeenCalledWith('get_team', {
        teamId: 't1',
        isAdmin: true,
        includeMembers: true,
        userClaims: mockUserClaims,
      });
      expect(result).toEqual(teamWithMembers);
    });

    it('throws HttpException on error', async () => {
      userService.send.mockReturnValue(
        throwError(() => ({ message: 'Team not found', status: 404 })),
      );

      try {
        await firstValueFrom(
          controller.getTeamMembers('bad-id', mockUserClaims),
        );
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).message).toBe('Team not found');
      }
    });
  });

  describe('transferOwner()', () => {
    it('sends UPDATE_TEAM_MEMBER with OWNER role', async () => {
      userService.send.mockReturnValue(of({ success: true }));

      const result = await firstValueFrom(
        controller.transferOwner('t1', { newOwnerId: 'u2' }, mockUserClaims),
      );

      expect(userService.send).toHaveBeenCalledWith('update_team_member', {
        teamId: 't1',
        userId: 'u2',
        role: 'OWNER',
        isAdmin: true,
        userClaims: mockUserClaims,
      });
      expect(result).toEqual({ success: true });
    });

    it('throws HttpException on error', async () => {
      userService.send.mockReturnValue(
        throwError(() => ({
          message: 'Failed to transfer team owner',
          status: 500,
        })),
      );

      await expect(
        firstValueFrom(
          controller.transferOwner('t1', { newOwnerId: 'u2' }, mockUserClaims),
        ),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('addMember()', () => {
    it('sends ADD_TEAM_MEMBER with default MEMBER role', async () => {
      userService.send.mockReturnValue(of({ added: true }));

      const result = await firstValueFrom(
        controller.addMember('t1', { userId: 'u3' }, mockUserClaims),
      );

      expect(userService.send).toHaveBeenCalledWith('add_team_member', {
        teamId: 't1',
        userId: 'u3',
        role: 'MEMBER',
        tokenLimit: undefined,
        isAdmin: true,
        userClaims: mockUserClaims,
      });
      expect(result).toEqual({ added: true });
    });

    it('passes explicit role and tokenLimit', async () => {
      userService.send.mockReturnValue(of({ added: true }));

      await firstValueFrom(
        controller.addMember(
          't1',
          { userId: 'u3', role: 'ADMIN', tokenLimit: 1000 },
          mockUserClaims,
        ),
      );

      expect(userService.send).toHaveBeenCalledWith('add_team_member', {
        teamId: 't1',
        userId: 'u3',
        role: 'ADMIN',
        tokenLimit: 1000,
        isAdmin: true,
        userClaims: mockUserClaims,
      });
    });

    it('throws HttpException on error', async () => {
      userService.send.mockReturnValue(
        throwError(() => ({ message: 'User already a member', status: 409 })),
      );

      try {
        await firstValueFrom(
          controller.addMember('t1', { userId: 'u3' }, mockUserClaims),
        );
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(409);
      }
    });
  });

  describe('updateMember()', () => {
    it('sends UPDATE_TEAM_MEMBER with body fields', async () => {
      userService.send.mockReturnValue(of({ updated: true }));

      const result = await firstValueFrom(
        controller.updateMember(
          't1',
          'u2',
          { role: 'ADMIN', tokenLimit: 500 },
          mockUserClaims,
        ),
      );

      expect(userService.send).toHaveBeenCalledWith('update_team_member', {
        teamId: 't1',
        userId: 'u2',
        role: 'ADMIN',
        tokenLimit: 500,
        isAdmin: true,
        userClaims: mockUserClaims,
      });
      expect(result).toEqual({ updated: true });
    });

    it('sends isActive when provided', async () => {
      userService.send.mockReturnValue(of({ updated: true }));

      await firstValueFrom(
        controller.updateMember(
          't1',
          'u2',
          { isActive: false },
          mockUserClaims,
        ),
      );

      expect(userService.send).toHaveBeenCalledWith('update_team_member', {
        teamId: 't1',
        userId: 'u2',
        isActive: false,
        isAdmin: true,
        userClaims: mockUserClaims,
      });
    });

    it('throws HttpException on error', async () => {
      userService.send.mockReturnValue(
        throwError(() => ({ message: 'Member not found', status: 404 })),
      );

      await expect(
        firstValueFrom(
          controller.updateMember(
            't1',
            'u2',
            { role: 'ADMIN' },
            mockUserClaims,
          ),
        ),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('removeMember()', () => {
    it('sends DELETE_TEAM_MEMBER with teamId and userId', async () => {
      userService.send.mockReturnValue(of({ removed: true }));

      const result = await firstValueFrom(
        controller.removeMember('t1', 'u2', mockUserClaims),
      );

      expect(userService.send).toHaveBeenCalledWith('delete_team_member', {
        teamId: 't1',
        userId: 'u2',
        isAdmin: true,
        userClaims: mockUserClaims,
      });
      expect(result).toEqual({ removed: true });
    });

    it('throws HttpException on error', async () => {
      userService.send.mockReturnValue(
        throwError(() => ({ message: 'Cannot remove owner', status: 400 })),
      );

      try {
        await firstValueFrom(
          controller.removeMember('t1', 'u2', mockUserClaims),
        );
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(400);
        expect((err as HttpException).message).toBe('Cannot remove owner');
      }
    });
  });
});
