import { EventEmitter } from 'events';
import * as http from 'http';
import { AdminGatewayController } from './admin-gateway.controller';

jest.mock('http');

const mockedHttp = jest.mocked(http);

function makeDockerSocket(containers: object[]) {
  const json = JSON.stringify(containers);

  mockedHttp.request.mockImplementation((_opts: any, callback: any) => {
    const res = new EventEmitter() as any;
    const req = new EventEmitter() as any;
    req.setTimeout = jest.fn((_ms: number, cb: () => void) => {
      req._timeoutCb = cb;
    });
    req.end = jest.fn(() => {
      if (callback) callback(res);
      setImmediate(() => {
        res.emit('data', Buffer.from(json));
        res.emit('end');
      });
    });
    req.destroy = jest.fn();
    return req;
  });
}

function makeDockerError() {
  mockedHttp.request.mockImplementation((_opts: any, _callback: any) => {
    const req = new EventEmitter() as any;
    req.setTimeout = jest.fn();
    req.end = jest.fn(() => {
      setImmediate(() => {
        req.emit('error', new Error('connect ENOENT /var/run/docker.sock'));
      });
    });
    req.destroy = jest.fn();
    return req;
  });
}

describe('AdminGatewayController', () => {
  let controller: AdminGatewayController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AdminGatewayController();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('check()', () => {
    it('returns { isAdmin: true }', () => {
      expect(controller.check()).toEqual({ isAdmin: true });
    });
  });

  describe('healthServices()', () => {
    it('returns all services online + containers when everything succeeds', async () => {
      const mockContainers = [
        {
          Id: 'abcdef123456789',
          Names: ['/my-container'],
          Image: 'nginx:latest',
          State: 'running',
          Status: 'Up 2 hours',
        },
      ];

      makeDockerSocket(mockContainers);

      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const result = await controller.healthServices();

      expect(result.services).toHaveLength(4);
      expect(result.services.every((s) => s.status === 'online')).toBe(true);
      expect(result.services.map((s) => s.name)).toEqual([
        'Gateway API',
        'Simulation Sessions',
        'Simulation Invitations',
        'LLM Service',
      ]);
      expect(result.containers).toHaveLength(1);
      expect(result.containers[0]).toMatchObject({
        name: 'my-container',
        image: 'nginx:latest',
        state: 'running',
        status: 'Up 2 hours',
      });
    });

    it('marks a service as offline when fetch throws', async () => {
      makeDockerSocket([]);

      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValue({ ok: true });

      const result = await controller.healthServices();

      expect(result.services[0].name).toBe('Gateway API');
      expect(result.services[0].status).toBe('offline');
      expect(result.services[1].status).toBe('online');
      expect(result.services[2].status).toBe('online');
      expect(result.services[3].status).toBe('online');
    });

    it('marks a service as degraded when response is not ok', async () => {
      makeDockerSocket([]);

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValue({ ok: true });

      const result = await controller.healthServices();

      expect(result.services[0].name).toBe('Gateway API');
      expect(result.services[0].status).toBe('degraded');
      expect(result.services[1].status).toBe('online');
    });

    it('returns empty containers when Docker socket errors', async () => {
      makeDockerError();

      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const result = await controller.healthServices();

      expect(result.containers).toEqual([]);
      expect(result.services).toHaveLength(4);
    });

    it('strips leading slash from container name', async () => {
      makeDockerSocket([
        {
          Id: 'abc123456789',
          Names: ['/my-app'],
          Image: 'myapp:1.0',
          State: 'running',
          Status: 'Up 1 hour',
        },
      ]);

      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const result = await controller.healthServices();

      expect(result.containers[0].name).toBe('my-app');
    });

    it('truncates container ID to 12 characters', async () => {
      const fullId = 'abcdef1234567890';
      makeDockerSocket([
        {
          Id: fullId,
          Names: ['/test'],
          Image: 'test:latest',
          State: 'exited',
          Status: 'Exited (0) 1 hour ago',
        },
      ]);

      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const result = await controller.healthServices();

      expect(result.containers[0].id).toBe(fullId.slice(0, 12));
      expect(result.containers[0].id).toHaveLength(12);
    });

    it('returns latency as a number for each service', async () => {
      makeDockerSocket([]);

      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const result = await controller.healthServices();

      for (const svc of result.services) {
        expect(typeof svc.latency).toBe('number');
        expect(svc.latency).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
