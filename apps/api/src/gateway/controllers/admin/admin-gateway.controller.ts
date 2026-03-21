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
import * as http from 'http';
import { catchError, timeout } from 'rxjs/operators';
import { throwError, firstValueFrom } from 'rxjs';
import { CheckSystemAdmin } from '../../guards/check-system-admin.guard';
import {
  USER_SERVICE_PATTERNS,
  SIMULATION_SERVICE_PATTERNS,
} from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';
import { AdminFeatureFlagsService } from '../../services/admin/admin-feature-flags.service';

interface DockerContainer {
  Id: string;
  Names: string[];
  Image: string;
  State: string;
  Status: string;
}

function dockerRequest<T>(path: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { socketPath: '/var/run/docker.sock', path, method: 'GET' },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString()) as T);
          } catch {
            reject(new Error('Invalid JSON from Docker API'));
          }
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(3000, () =>
      req.destroy(new Error('Docker request timeout')),
    );
    req.end();
  });
}

@Controller({ path: 'admin', version: '1' })
@UseGuards(CheckSystemAdmin)
export class AdminGatewayController {
  constructor(
    @Inject('USER_SERVICE') private readonly userService: ClientProxy,
    @Inject('SIMULATION_SERVICE')
    private readonly simulationService: ClientProxy,
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

    const serviceEndpoints = [
      { name: 'Gateway API', path: '/health' },
      { name: 'Simulation Sessions', path: '/simulation/sessions/health' },
      {
        name: 'Simulation Invitations',
        path: '/simulation/invitations/health',
      },
      { name: 'LLM Service', path: '/simulation/llm/health' },
    ];

    const serviceResults = await Promise.allSettled(
      serviceEndpoints.map(async ({ name, path }) => {
        const start = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        try {
          const res = await fetch(`${baseUrl}${path}`, {
            signal: controller.signal,
          });
          const latency = Date.now() - start;
          clearTimeout(timeoutId);
          return {
            name,
            status: res.ok ? ('online' as const) : ('degraded' as const),
            latency,
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

    const services = serviceResults.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : {
            name: serviceEndpoints[i].name,
            status: 'offline' as const,
            latency: 0,
          },
    );

    let containers: Array<{
      id: string;
      name: string;
      image: string;
      state: string;
      status: string;
    }> = [];

    try {
      const raw = await dockerRequest<DockerContainer[]>(
        '/containers/json?all=1',
      );
      containers = raw.map((c) => ({
        id: c.Id.slice(0, 12),
        name: (c.Names[0] ?? c.Id.slice(0, 12)).replace(/^\//, ''),
        image: c.Image,
        state: c.State,
        status: c.Status,
      }));
    } catch {
      // Docker socket not available or permission denied — return empty list
    }

    return { services, containers };
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
