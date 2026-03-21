import { Controller, Get, UseGuards } from '@nestjs/common';
import * as http from 'http';
import { CheckSystemAdmin } from '../../guards/check-system-admin.guard';

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

@Controller('admin')
@UseGuards(CheckSystemAdmin)
export class AdminGatewayController {
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
}
