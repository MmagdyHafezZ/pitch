import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpException,
  HttpStatus,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, timeout } from 'rxjs/operators';
import { throwError, firstValueFrom } from 'rxjs';
import { CheckSystemAdmin } from '../../guards/check-system-admin.guard';
import {
  USER_SERVICE_PATTERNS,
  SIMULATION_SERVICE_PATTERNS,
} from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { AdminFeatureFlagsService } from '../../services/admin/admin-feature-flags.service';

@Controller({ path: 'admin', version: '1' })
@UseGuards(CheckSystemAdmin)
export class AdminGatewayController {
  constructor(
    @Inject('USER_SERVICE') private readonly userService: ClientProxy,
    @Inject('SIMULATION_SERVICE')
    private readonly simulationService: ClientProxy,
    @Inject('ANALYTICS_SERVICE')
    private readonly analyticsService: ClientProxy,
    @Inject('SUPPORT_SERVICE')
    private readonly supportService: ClientProxy,
    @Inject('CRM_SERVICE') private readonly crmService: ClientProxy,
    @Inject('LTI_SERVICE') private readonly ltiService: ClientProxy,
    @Inject('S3_SERVICE') private readonly s3Service: ClientProxy,
    private readonly featureFlagsService: AdminFeatureFlagsService,
  ) {}

  @Get('check')
  check() {
    return { isAdmin: true };
  }

  @Get('health')
  async healthServices() {
    const port = process.env.PORT ?? 8000;
    const baseUrl = `http://localhost:${port}/api/v1`;

    // ── HTTP checks (simulation services run in-process) ──────────────────────
    const httpChecks = [
      { name: 'Gateway API', path: '/health' },
      { name: 'Simulation Sessions', path: '/simulation/sessions/health' },
      {
        name: 'Simulation Invitations',
        path: '/simulation/invitations/health',
      },
      { name: 'LLM Service', path: '/simulation/llm/health' },
    ];

    const httpResults = await Promise.allSettled(
      httpChecks.map(async ({ name, path }) => {
        const start = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        try {
          const res = await fetch(`${baseUrl}${path}`, {
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          return {
            name,
            status: res.ok ? ('online' as const) : ('degraded' as const),
            latency: Date.now() - start,
          };
        } catch {
          clearTimeout(timeoutId);
          return {
            name,
            status: 'offline' as const,
            latency: Date.now() - start,
          };
        }
      }),
    );

    // ── RabbitMQ health checks (separate microservices) ───────────────────────
    const rpcCheck = async (
      name: string,
      client: ClientProxy,
      pattern: string,
    ) => {
      const start = Date.now();
      try {
        await firstValueFrom(
          client.send(pattern, {}).pipe(
            timeout(3000),
            catchError(() => throwError(() => new Error('timeout'))),
          ),
        );
        return { name, status: 'online' as const, latency: Date.now() - start };
      } catch {
        return {
          name,
          status: 'offline' as const,
          latency: Date.now() - start,
        };
      }
    };

    const rpcResults = await Promise.allSettled([
      rpcCheck('User Service', this.userService, 'health'),
      rpcCheck('Analytics Service', this.analyticsService, 'health'),
      rpcCheck('Support Service', this.supportService, 'health'),
      rpcCheck('CRM Service', this.crmService, 'health'),
      rpcCheck('LTI Service', this.ltiService, 'health'),
      rpcCheck('S3 Service', this.s3Service, 's3.health'),
    ]);

    const rpcServices = [
      'User Service',
      'Analytics Service',
      'Support Service',
      'CRM Service',
      'LTI Service',
      'S3 Service',
    ];

    const services = [
      ...httpResults.map((r, i) =>
        r.status === 'fulfilled'
          ? r.value
          : {
              name: httpChecks[i].name,
              status: 'offline' as const,
              latency: 0,
            },
      ),
      ...rpcResults.map((r, i) =>
        r.status === 'fulfilled'
          ? r.value
          : { name: rpcServices[i], status: 'offline' as const, latency: 0 },
      ),
    ];

    return { services };
  }

  @Get('overview')
  async overview() {
    const pipe = <T>(pattern: string, payload: Record<string, unknown>) =>
      firstValueFrom(
        this.userService.send<T>(pattern, payload).pipe(
          timeout(5000),
          catchError(() => throwError(() => null)),
        ),
      ).catch(() => null);

    const simPipe = <T>(pattern: string, payload: Record<string, unknown>) =>
      firstValueFrom(
        this.simulationService.send<T>(pattern, payload).pipe(
          timeout(5000),
          catchError(() => throwError(() => null)),
        ),
      ).catch(() => null);

    const [users, teams, sessions, plans] = await Promise.all([
      pipe<any[]>(USER_SERVICE_PATTERNS.GET_USERS, { isAdmin: true }),
      pipe<any[]>(USER_SERVICE_PATTERNS.GET_TEAMS, { isAdmin: true }),
      simPipe<{ sessions: any[]; total: number }>(
        SIMULATION_SERVICE_PATTERNS.LIST_SESSIONS,
        { limit: 1 },
      ),
      pipe<any[]>(USER_SERVICE_PATTERNS.GET_PLANS, { isAdmin: true }),
    ]);

    return {
      userCount: Array.isArray(users) ? users.length : 0,
      teamCount: Array.isArray(teams) ? teams.length : 0,
      sessionCount:
        sessions && typeof sessions === 'object' && 'total' in sessions
          ? (sessions as { total: number }).total
          : 0,
      planCount: Array.isArray(plans) ? plans.length : 0,
    };
  }

  @Get('version')
  version() {
    return {
      version: process.env.npm_package_version ?? '0.0.0',
      nodeVersion: process.version,
      uptime: process.uptime(),
      environment: process.env.NODE_ENV ?? 'development',
    };
  }

  @Get('runtime-config')
  runtimeConfig() {
    return {
      NODE_ENV: process.env.NODE_ENV ?? 'development',
      PORT: process.env.PORT ?? '8000',
      featureFlags: this.featureFlagsService.list(),
    };
  }

  @Get('feature-flags')
  listFeatureFlags() {
    return this.featureFlagsService.list();
  }

  @Post('feature-flags')
  setFeatureFlag(@Body() body: { key: string; enabled: boolean }) {
    if (!body?.key || typeof body.enabled !== 'boolean') {
      throw new HttpException(
        'Body must contain { key: string, enabled: boolean }',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.featureFlagsService.set(body.key, body.enabled);
  }

  @Delete('feature-flags/:key')
  deleteFeatureFlag(@Param('key') key: string) {
    const removed = this.featureFlagsService.delete(key);
    if (!removed) {
      throw new HttpException(
        `Feature flag '${key}' not found`,
        HttpStatus.NOT_FOUND,
      );
    }
    return { deleted: true };
  }
}
