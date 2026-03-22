import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import { AdminGatewayController } from './admin-gateway.controller';
import { AdminFeatureFlagsService } from '../../services/admin/admin-feature-flags.service';
import { CheckSystemAdmin } from '../../guards/check-system-admin.guard';

function makeClientProxy(sendResult: any = { status: 'ok' }) {
  return {
    send: jest.fn().mockReturnValue(of(sendResult)),
  };
}

describe('AdminGatewayController', () => {
  let controller: AdminGatewayController;
  let userService: ReturnType<typeof makeClientProxy>;
  let simulationService: ReturnType<typeof makeClientProxy>;
  let analyticsService: ReturnType<typeof makeClientProxy>;
  let supportService: ReturnType<typeof makeClientProxy>;
  let crmService: ReturnType<typeof makeClientProxy>;
  let ltiService: ReturnType<typeof makeClientProxy>;
  let s3Service: ReturnType<typeof makeClientProxy>;
  let featureFlagsService: AdminFeatureFlagsService;

  beforeEach(async () => {
    userService = makeClientProxy([]);
    simulationService = makeClientProxy({ sessions: [], total: 0 });
    analyticsService = makeClientProxy({ status: 'ok' });
    supportService = makeClientProxy({ status: 'ok' });
    crmService = makeClientProxy({ status: 'ok' });
    ltiService = makeClientProxy({ status: 'ok' });
    s3Service = makeClientProxy({ status: 'ok' });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminGatewayController],
      providers: [
        AdminFeatureFlagsService,
        CheckSystemAdmin,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn().mockReturnValue({ email: 'admin@test.com' }),
          },
        },
        { provide: 'USER_SERVICE', useValue: userService },
        { provide: 'SIMULATION_SERVICE', useValue: simulationService },
        { provide: 'ANALYTICS_SERVICE', useValue: analyticsService },
        { provide: 'SUPPORT_SERVICE', useValue: supportService },
        { provide: 'CRM_SERVICE', useValue: crmService },
        { provide: 'LTI_SERVICE', useValue: ltiService },
        { provide: 'S3_SERVICE', useValue: s3Service },
      ],
    }).compile();

    controller = module.get<AdminGatewayController>(AdminGatewayController);
    featureFlagsService = module.get<AdminFeatureFlagsService>(
      AdminFeatureFlagsService,
    );

    global.fetch = jest.fn().mockResolvedValue({ ok: true });
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
    it('returns 10 services total (4 HTTP + 6 RPC)', async () => {
      const result = await controller.healthServices();

      expect(result.services).toHaveLength(10);
    });

    it('includes the expected service names', async () => {
      const result = await controller.healthServices();
      const names = result.services.map((s) => s.name);

      expect(names).toContain('Gateway API');
      expect(names).toContain('Simulation Sessions');
      expect(names).toContain('Simulation Invitations');
      expect(names).toContain('LLM Service');
      expect(names).toContain('User Service');
      expect(names).toContain('Analytics Service');
      expect(names).toContain('Support Service');
      expect(names).toContain('CRM Service');
      expect(names).toContain('LTI Service');
      expect(names).toContain('S3 Service');
    });

    it('marks HTTP service as online when fetch returns ok', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const result = await controller.healthServices();
      const gatewayApi = result.services.find((s) => s.name === 'Gateway API');

      expect(gatewayApi?.status).toBe('online');
    });

    it('marks HTTP service as offline when fetch throws', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValue({ ok: true });

      const result = await controller.healthServices();
      const gatewayApi = result.services.find((s) => s.name === 'Gateway API');

      expect(gatewayApi?.status).toBe('offline');
    });

    it('marks HTTP service as degraded when response is not ok', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValue({ ok: true });

      const result = await controller.healthServices();
      const gatewayApi = result.services.find((s) => s.name === 'Gateway API');

      expect(gatewayApi?.status).toBe('degraded');
    });

    it('marks RPC service as offline when send throws', async () => {
      userService.send.mockReturnValue(throwError(() => new Error('timeout')));

      const result = await controller.healthServices();
      const userSvc = result.services.find((s) => s.name === 'User Service');

      expect(userSvc?.status).toBe('offline');
    });

    it('returns latency as a non-negative number for each service', async () => {
      const result = await controller.healthServices();

      for (const svc of result.services) {
        expect(typeof svc.latency).toBe('number');
        expect(svc.latency).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('overview()', () => {
    it('returns counts from microservices', async () => {
      userService.send.mockImplementation((pattern: string) => {
        if (pattern === 'get_users') return of([{ id: 'u1' }, { id: 'u2' }]);
        if (pattern === 'get_teams') return of([{ id: 't1' }]);
        if (pattern === 'get_plans')
          return of([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]);
        return of([]);
      });
      simulationService.send.mockReturnValue(of({ sessions: [], total: 5 }));

      const result = await controller.overview();

      expect(result).toMatchObject({
        userCount: 2,
        teamCount: 1,
        sessionCount: 5,
        planCount: 3,
      });
    });

    it('returns zero counts when microservices are unavailable', async () => {
      userService.send.mockReturnValue(throwError(() => new Error('timeout')));
      simulationService.send.mockReturnValue(
        throwError(() => new Error('timeout')),
      );

      const result = await controller.overview();

      expect(result).toEqual({
        userCount: 0,
        teamCount: 0,
        sessionCount: 0,
        planCount: 0,
      });
    });
  });

  describe('version()', () => {
    it('returns version info', () => {
      const result = controller.version();

      expect(result).toHaveProperty('nodeVersion');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('environment');
      expect(result).toHaveProperty('version');
    });
  });

  describe('runtimeConfig()', () => {
    it('returns runtime config with featureFlags array', () => {
      const result = controller.runtimeConfig();

      expect(result).toHaveProperty('NODE_ENV');
      expect(result).toHaveProperty('PORT');
      expect(Array.isArray(result.featureFlags)).toBe(true);
    });
  });

  describe('feature flags CRUD', () => {
    it('listFeatureFlags() returns empty array initially', () => {
      const result = controller.listFeatureFlags();
      expect(Array.isArray(result)).toBe(true);
    });

    it('setFeatureFlag() adds a flag', () => {
      const result = controller.setFeatureFlag({
        key: 'test-flag',
        enabled: true,
      });
      expect(result).toEqual({ key: 'test-flag', enabled: true });

      const flags = controller.listFeatureFlags();
      expect(flags).toContainEqual({ key: 'test-flag', enabled: true });
    });

    it('setFeatureFlag() throws 400 when body is invalid', () => {
      expect(() =>
        controller.setFeatureFlag({ key: '', enabled: true }),
      ).toThrow();
      expect(() =>
        controller.setFeatureFlag({ key: 'x', enabled: 'not-bool' as any }),
      ).toThrow();
    });

    it('deleteFeatureFlag() removes an existing flag', () => {
      controller.setFeatureFlag({ key: 'remove-me', enabled: false });
      const result = controller.deleteFeatureFlag('remove-me');
      expect(result).toEqual({ deleted: true });

      const flags = controller.listFeatureFlags();
      expect(flags.find((f) => f.key === 'remove-me')).toBeUndefined();
    });

    it('deleteFeatureFlag() throws 404 when flag does not exist', () => {
      expect(() => controller.deleteFeatureFlag('nonexistent')).toThrow();
    });
  });
});
