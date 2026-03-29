import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import type { ClientProxy } from '@nestjs/microservices';
import { LtiManagementGatewayController } from '../lti-management-gateway.controller';
import { LTI_PATTERNS } from '@microservices/lti/common/constants/lti-patterns.constants';

const createClientProxyMock = (): jest.Mocked<
  Pick<ClientProxy, 'send' | 'emit'>
> => ({
  send: jest.fn(),
  emit: jest.fn(),
});

describe('LtiManagementGatewayController', () => {
  let controller: LtiManagementGatewayController;
  let ltiClient: ReturnType<typeof createClientProxyMock>;

  beforeEach(async () => {
    ltiClient = createClientProxyMock();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LtiManagementGatewayController],
      providers: [{ provide: 'LTI_SERVICE', useValue: ltiClient }],
    }).compile();

    controller = module.get(LtiManagementGatewayController);
  });

  afterEach(() => jest.clearAllMocks());

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    const dto = {
      name: 'Canvas LMS',
      issuer: 'https://canvas.example.com',
      clientId: 'client-123',
    } as any;

    it('sends PLATFORM_CREATE and returns the new platform', async () => {
      const created = { id: 'p-1', ...dto };
      ltiClient.send.mockReturnValue(of(created));

      const result = await controller.create(dto);

      expect(ltiClient.send).toHaveBeenCalledWith(
        LTI_PATTERNS.PLATFORM_CREATE,
        dto,
      );
      expect(result).toEqual(created);
    });

    it('propagates errors from lti service', async () => {
      ltiClient.send.mockReturnValue(
        throwError(() => new Error('create failed')),
      );

      await expect(controller.create(dto)).rejects.toThrow('create failed');
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('sends PLATFORM_FIND_ALL and returns all platforms', async () => {
      const platforms = [{ id: 'p-1' }, { id: 'p-2' }];
      ltiClient.send.mockReturnValue(of(platforms));

      const result = await controller.findAll();

      expect(ltiClient.send).toHaveBeenCalledWith(
        LTI_PATTERNS.PLATFORM_FIND_ALL,
        {},
      );
      expect(result).toEqual(platforms);
    });

    it('propagates errors from lti service', async () => {
      ltiClient.send.mockReturnValue(
        throwError(() => new Error('find all failed')),
      );

      await expect(controller.findAll()).rejects.toThrow('find all failed');
    });
  });

  // ── getCredentials ────────────────────────────────────────────────────────

  describe('getCredentials()', () => {
    it('returns v13 and v11 credential URLs based on API_BASE_URL env', () => {
      process.env.API_BASE_URL = 'https://api.pitch.com';

      const result = controller.getCredentials();

      expect(result).toEqual(
        expect.objectContaining({
          v13: expect.objectContaining({
            launchUrl: 'https://api.pitch.com/api/v1/lti/v1.3/launch',
            oidcLoginUrl: 'https://api.pitch.com/api/v1/lti/v1.3/oidc/login',
            jwksUrl: 'https://api.pitch.com/api/v1/lti/v1.3/jwks',
          }),
          v11: expect.objectContaining({
            launchUrl: 'https://api.pitch.com/api/v1/lti/v1.1/launch',
          }),
        }),
      );

      delete process.env.API_BASE_URL;
    });

    it('falls back to localhost when API_BASE_URL is not set', () => {
      delete process.env.API_BASE_URL;

      const result = controller.getCredentials();

      expect(result.v13.launchUrl).toContain('http://localhost:4000');
    });

    it('returns publicKeyPem as null when LTI_TOOL_PUBLIC_JWK is not set', () => {
      delete process.env.LTI_TOOL_PUBLIC_JWK;

      const result = controller.getCredentials();

      expect(result.v13.publicKeyPem).toBeNull();
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('sends PLATFORM_FIND_ONE with id and returns the platform', async () => {
      const platform = { id: 'p-42', name: 'Moodle' };
      ltiClient.send.mockReturnValue(of(platform));

      const result = await controller.findOne('p-42');

      expect(ltiClient.send).toHaveBeenCalledWith(
        LTI_PATTERNS.PLATFORM_FIND_ONE,
        { id: 'p-42' },
      );
      expect(result).toEqual(platform);
    });

    it('propagates errors from lti service', async () => {
      ltiClient.send.mockReturnValue(throwError(() => new Error('not found')));

      await expect(controller.findOne('p-42')).rejects.toThrow('not found');
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    const partialDto = { name: 'Updated Name' };

    it('sends PLATFORM_UPDATE with id and dto, returns updated platform', async () => {
      const updated = { id: 'p-42', name: 'Updated Name' };
      ltiClient.send.mockReturnValue(of(updated));

      const result = await controller.update('p-42', partialDto);

      expect(ltiClient.send).toHaveBeenCalledWith(
        LTI_PATTERNS.PLATFORM_UPDATE,
        {
          id: 'p-42',
          dto: partialDto,
        },
      );
      expect(result).toEqual(updated);
    });

    it('propagates errors from lti service', async () => {
      ltiClient.send.mockReturnValue(
        throwError(() => new Error('update failed')),
      );

      await expect(controller.update('p-42', partialDto)).rejects.toThrow(
        'update failed',
      );
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('sends PLATFORM_DELETE with id and returns result', async () => {
      const response = { deleted: true };
      ltiClient.send.mockReturnValue(of(response));

      const result = await controller.remove('p-42');

      expect(ltiClient.send).toHaveBeenCalledWith(
        LTI_PATTERNS.PLATFORM_DELETE,
        { id: 'p-42' },
      );
      expect(result).toEqual(response);
    });

    it('propagates errors from lti service', async () => {
      ltiClient.send.mockReturnValue(
        throwError(() => new Error('delete failed')),
      );

      await expect(controller.remove('p-42')).rejects.toThrow('delete failed');
    });
  });

  // ── getSession ────────────────────────────────────────────────────────────

  describe('getSession()', () => {
    it('sends SESSION_FIND with sessionId and returns session details', async () => {
      const session = { sessionId: 'sess-1', userId: 'u-1' };
      ltiClient.send.mockReturnValue(of(session));

      const result = await controller.getSession('sess-1');

      expect(ltiClient.send).toHaveBeenCalledWith(LTI_PATTERNS.SESSION_FIND, {
        sessionId: 'sess-1',
      });
      expect(result).toEqual(session);
    });

    it('propagates errors from lti service', async () => {
      ltiClient.send.mockReturnValue(
        throwError(() => new Error('session not found')),
      );

      await expect(controller.getSession('sess-1')).rejects.toThrow(
        'session not found',
      );
    });
  });

  // ── linkSession ───────────────────────────────────────────────────────────

  describe('linkSession()', () => {
    it('sends SESSION_LINK_PITCH with sessionId and body fields', async () => {
      const body = { pitchSessionId: 'pitch-s-1', pitchUserId: 'pitch-u-1' };
      const response = { linked: true };
      ltiClient.send.mockReturnValue(of(response));

      const result = await controller.linkSession('sess-1', body);

      expect(ltiClient.send).toHaveBeenCalledWith(
        LTI_PATTERNS.SESSION_LINK_PITCH,
        {
          sessionId: 'sess-1',
          pitchSessionId: 'pitch-s-1',
          pitchUserId: 'pitch-u-1',
        },
      );
      expect(result).toEqual(response);
    });

    it('sends SESSION_LINK_PITCH with only sessionId when body is empty', async () => {
      ltiClient.send.mockReturnValue(of({ linked: true }));

      await controller.linkSession('sess-2', {});

      expect(ltiClient.send).toHaveBeenCalledWith(
        LTI_PATTERNS.SESSION_LINK_PITCH,
        {
          sessionId: 'sess-2',
        },
      );
    });

    it('propagates errors from lti service', async () => {
      ltiClient.send.mockReturnValue(
        throwError(() => new Error('link failed')),
      );

      await expect(controller.linkSession('sess-1', {})).rejects.toThrow(
        'link failed',
      );
    });
  });
});
