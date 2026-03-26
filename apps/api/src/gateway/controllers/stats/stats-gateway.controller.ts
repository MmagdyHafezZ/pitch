import { Controller, Get, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { catchError, timeout } from 'rxjs/operators';
import { lastValueFrom, of } from 'rxjs';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { SessionService } from '@microservices/simulation/services/session.service';

@ApiTags('stats')
@Controller({ path: 'stats', version: '1' })
export class StatsGatewayController {
  constructor(
    @Inject('USER_SERVICE') private readonly userService: ClientProxy,
    private readonly sessionService: SessionService,
  ) {}

  @Get('public')
  @ApiOperation({ summary: 'Public platform statistics for landing page' })
  @ApiResponse({
    status: 200,
    description: 'Platform statistics',
    schema: {
      type: 'object',
      properties: {
        activeUsers: { type: 'number' },
        activeSessions: { type: 'number' },
        teamWorkspaces: { type: 'number' },
        rehearsalsThisWeek: { type: 'number' },
        totalRehearsals: { type: 'number' },
      },
    },
  })
  async getPublicStats() {
    const [sessionStats, userStats] = await Promise.all([
      this.sessionService.getPlatformStats(),
      lastValueFrom(
        this.userService
          .send<{
            activeUsers: number;
            teamWorkspaces: number;
          }>(USER_SERVICE_PATTERNS.GET_PLATFORM_STATS, {})
          .pipe(
            timeout(5000),
            catchError(() => of({ activeUsers: 0, teamWorkspaces: 0 })),
          ),
      ),
    ]);

    return {
      activeUsers: userStats.activeUsers,
      activeSessions: sessionStats.activeSessions,
      teamWorkspaces: userStats.teamWorkspaces,
      rehearsalsThisWeek: sessionStats.rehearsalsThisWeek,
      totalRehearsals: sessionStats.totalRehearsals,
    };
  }
}
