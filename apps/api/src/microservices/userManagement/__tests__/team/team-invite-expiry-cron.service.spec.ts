import { TeamInviteExpiryCronService } from '../../team/services/team-invite-expiry-cron.service';

describe('TeamInviteExpiryCronService', () => {
  const teamService = {
    cleanupExpiredInvitations: jest.fn(),
  };

  let service: TeamInviteExpiryCronService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TeamInviteExpiryCronService(teamService as any);
  });

  it('runs cleanupExpiredInvitations on cron execution', async () => {
    teamService.cleanupExpiredInvitations.mockResolvedValue({
      deletedMembershipInvites: 1,
      deletedSignupInvites: 2,
    });

    await service.cleanupExpiredInvites();

    expect(teamService.cleanupExpiredInvitations).toHaveBeenCalledTimes(1);
  });

  it('does not throw when cleanup fails', async () => {
    teamService.cleanupExpiredInvitations.mockRejectedValue(
      new Error('cleanup failed'),
    );

    await expect(service.cleanupExpiredInvites()).resolves.toBeUndefined();
  });
});
