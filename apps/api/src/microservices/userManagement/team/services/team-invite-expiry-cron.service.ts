import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TeamService } from './team.service';

@Injectable()
export class TeamInviteExpiryCronService {
  private readonly logger = new Logger(TeamInviteExpiryCronService.name);

  constructor(private readonly teamService: TeamService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredInvites() {
    this.logger.log('Starting expired team invitation cleanup job');

    try {
      const result = await this.teamService.cleanupExpiredInvitations();
      this.logger.log(
        `Expired invitation cleanup complete (memberships=${result.deletedMembershipInvites}, signupInvites=${result.deletedSignupInvites})`,
      );
    } catch (error) {
      this.logger.error('Failed to cleanup expired team invitations', error);
    }
  }
}
