import { of, throwError, lastValueFrom } from 'rxjs';
import { HttpException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { TeamGatewayController } from '../team-gateway.controller';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';

// ── helpers ──────────────────────────────────────────────────────────────────

const makeClient = (): jest.Mocked<ClientProxy> =>
  ({ send: jest.fn() }) as unknown as jest.Mocked<ClientProxy>;

const userClaims = { id: 'owner-1', email: 'owner@x.com', name: 'Owner' };

// ── tests ─────────────────────────────────────────────────────────────────────

describe('TeamGatewayController', () => {
  // ── createTeam ────────────────────────────────────────────────────────────

  describe('createTeam()', () => {
    it('sends CREATE_TEAM with ownerId, createdBy and userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ id: 'team-1' }));
      const ctrl = new TeamGatewayController(client);

      const dto = { name: 'Alpha Team' } as any;
      const result = await lastValueFrom(ctrl.createTeam(dto, userClaims));

      expect(result).toEqual({ id: 'team-1' });
      expect(client.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.CREATE_TEAM,
        {
          ...dto,
          ownerId: userClaims.id,
          createdBy: userClaims.id,
          userClaims,
        },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new TeamGatewayController(client);

      await expect(
        lastValueFrom(ctrl.createTeam({} as any, userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── updateTeam ────────────────────────────────────────────────────────────

  describe('updateTeam()', () => {
    it('sends UPDATE_TEAM with teamId, dto and userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ id: 'team-1', updated: true }));
      const ctrl = new TeamGatewayController(client);

      const dto = { name: 'Updated Team' } as any;
      await lastValueFrom(ctrl.updateTeam('team-1', dto, userClaims));

      expect(client.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.UPDATE_TEAM,
        {
          teamId: 'team-1',
          ...dto,
          userClaims,
        },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new TeamGatewayController(client);

      await expect(
        lastValueFrom(ctrl.updateTeam('team-1', {} as any, userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── deleteTeam ────────────────────────────────────────────────────────────

  describe('deleteTeam()', () => {
    it('sends DELETE_TEAM with teamId and userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ deleted: true }));
      const ctrl = new TeamGatewayController(client);

      await lastValueFrom(ctrl.deleteTeam('team-1', userClaims));

      expect(client.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.DELETE_TEAM,
        {
          teamId: 'team-1',
          userClaims,
        },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new TeamGatewayController(client);

      await expect(
        lastValueFrom(ctrl.deleteTeam('t', userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── getTeams ──────────────────────────────────────────────────────────────

  describe('getTeams()', () => {
    it('sends GET_TEAMS with userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of([{ id: 'team-1' }]));
      const ctrl = new TeamGatewayController(client);

      const result = await lastValueFrom(ctrl.getTeams(userClaims));

      expect(result).toEqual([{ id: 'team-1' }]);
      expect(client.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.GET_TEAMS,
        { userClaims },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new TeamGatewayController(client);

      await expect(lastValueFrom(ctrl.getTeams(userClaims))).rejects.toThrow(
        HttpException,
      );
    });
  });

  // ── getUserTeams ──────────────────────────────────────────────────────────

  describe('getUserTeams()', () => {
    it('sends GET_USER_TEAMS with userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of([{ id: 'team-2' }]));
      const ctrl = new TeamGatewayController(client);

      await lastValueFrom(ctrl.getUserTeams(userClaims));

      expect(client.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.GET_USER_TEAMS,
        {
          userClaims,
        },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new TeamGatewayController(client);

      await expect(
        lastValueFrom(ctrl.getUserTeams(userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── getTeamById ───────────────────────────────────────────────────────────

  describe('getTeamById()', () => {
    it('sends GET_TEAM with teamId and userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ id: 'team-1' }));
      const ctrl = new TeamGatewayController(client);

      await lastValueFrom(ctrl.getTeamById('team-1', userClaims));

      expect(client.send).toHaveBeenCalledWith(USER_SERVICE_PATTERNS.GET_TEAM, {
        teamId: 'team-1',
        userClaims,
      });
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(
        throwError(() => ({ status: 404, message: 'Not found' })),
      );
      const ctrl = new TeamGatewayController(client);

      await expect(
        lastValueFrom(ctrl.getTeamById('missing', userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── addTeamMember ─────────────────────────────────────────────────────────

  describe('addTeamMember()', () => {
    it('sends ADD_TEAM_MEMBER with teamId, dto and userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ added: true }));
      const ctrl = new TeamGatewayController(client);

      const dto = { userId: 'new-member' } as any;
      await lastValueFrom(ctrl.addTeamMember('team-1', dto, userClaims));

      expect(client.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.ADD_TEAM_MEMBER,
        {
          teamId: 'team-1',
          ...dto,
          userClaims,
        },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new TeamGatewayController(client);

      await expect(
        lastValueFrom(ctrl.addTeamMember('team-1', {} as any, userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── inviteTeamMember ──────────────────────────────────────────────────────

  describe('inviteTeamMember()', () => {
    it('sends INVITE_TEAM_MEMBER with teamId, dto and userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ invited: true }));
      const ctrl = new TeamGatewayController(client);

      const dto = { email: 'new@member.com' } as any;
      await lastValueFrom(ctrl.inviteTeamMember('team-1', dto, userClaims));

      expect(client.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.INVITE_TEAM_MEMBER,
        {
          teamId: 'team-1',
          ...dto,
          userClaims,
        },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new TeamGatewayController(client);

      await expect(
        lastValueFrom(ctrl.inviteTeamMember('t', {} as any, userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── updateTeamMember ──────────────────────────────────────────────────────

  describe('updateTeamMember()', () => {
    it('sends ADD_TEAM_MEMBER (update path) with teamId, userId, dto and userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ updated: true }));
      const ctrl = new TeamGatewayController(client);

      const dto = { role: 'ADMIN' } as any;
      await lastValueFrom(
        ctrl.updateTeamMember('team-1', 'member-1', dto, userClaims),
      );

      expect(client.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.ADD_TEAM_MEMBER,
        {
          teamId: 'team-1',
          userId: 'member-1',
          ...dto,
          userClaims,
        },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new TeamGatewayController(client);

      await expect(
        lastValueFrom(ctrl.updateTeamMember('t', 'u', {} as any, userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── removeTeamMember ──────────────────────────────────────────────────────

  describe('removeTeamMember()', () => {
    it('sends DELETE_TEAM_MEMBER with teamId, userId and userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ removed: true }));
      const ctrl = new TeamGatewayController(client);

      await lastValueFrom(
        ctrl.removeTeamMember('team-1', 'member-1', userClaims),
      );

      expect(client.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.DELETE_TEAM_MEMBER,
        {
          teamId: 'team-1',
          userId: 'member-1',
          userClaims,
        },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new TeamGatewayController(client);

      await expect(
        lastValueFrom(ctrl.removeTeamMember('t', 'u', userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── sendTeamSignupInvite ───────────────────────────────────────────────────

  describe('sendTeamSignupInvite()', () => {
    it('sends SEND_TEAM_SIGNUP_INVITE with teamId, dto and userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ sent: true }));
      const ctrl = new TeamGatewayController(client);

      const dto = { email: 'new@member.com' } as any;
      await lastValueFrom(ctrl.sendTeamSignupInvite('team-1', dto, userClaims));

      expect(client.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.SEND_TEAM_SIGNUP_INVITE,
        {
          teamId: 'team-1',
          ...dto,
          userClaims,
        },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new TeamGatewayController(client);

      await expect(
        lastValueFrom(ctrl.sendTeamSignupInvite('t', {} as any, userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── acceptTeamInvite ──────────────────────────────────────────────────────

  describe('acceptTeamInvite()', () => {
    it('sends ACCEPT_TEAM_INVITE with teamId and userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ accepted: true }));
      const ctrl = new TeamGatewayController(client);

      await lastValueFrom(ctrl.acceptTeamInvite('team-1', userClaims));

      expect(client.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.ACCEPT_TEAM_INVITE,
        {
          teamId: 'team-1',
          userClaims,
        },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new TeamGatewayController(client);

      await expect(
        lastValueFrom(ctrl.acceptTeamInvite('t', userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── claimTeamSignupInvite ─────────────────────────────────────────────────

  describe('claimTeamSignupInvite()', () => {
    it('sends CLAIM_TEAM_SIGNUP_INVITE with teamId and userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ claimed: true }));
      const ctrl = new TeamGatewayController(client);

      await lastValueFrom(ctrl.claimTeamSignupInvite('team-1', userClaims));

      expect(client.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.CLAIM_TEAM_SIGNUP_INVITE,
        {
          teamId: 'team-1',
          userClaims,
        },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new TeamGatewayController(client);

      await expect(
        lastValueFrom(ctrl.claimTeamSignupInvite('t', userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });
});
