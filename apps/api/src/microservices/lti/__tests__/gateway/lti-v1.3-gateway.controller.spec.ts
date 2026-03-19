/**
 * Unit tests for LtiV1p3GatewayController.
 *
 * The gateway receives HTTP from the LMS, delegates to the LTI microservice
 * (via ltiClient) and to the user microservice (via userClient) through
 * RabbitMQ ClientProxy, then issues an HTTP redirect.
 *
 * Strategy: mock both ClientProxy instances plus the Express Response object.
 * All `send()` calls return RxJS `of()` observables so `firstValueFrom` works.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { LtiV1p3GatewayController } from '../../../../gateway/controllers/lti/lti-v1.3-gateway.controller';

// ── Mock helpers ──────────────────────────────────────────────────────────────

const makeLtiClient = () => ({ send: jest.fn() });
const makeUserClient = () => ({ send: jest.fn() });
const makeRes = () => ({
  redirect: jest.fn(),
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

const DEFAULT_LTI_RESULT = {
  context: {
    sessionId: 'lti-session-1',
    platformId: 'platform-1',
    user: {
      email: 'learner@university.edu',
      name: 'Alice Learner',
      sub: 'sub-alice',
    },
  },
};
const DEFAULT_LTI_SESSION = { pitchSessionId: null };
const DEFAULT_AUTH_RESULT = {
  token: 'access-jwt',
  refreshToken: 'refresh-jwt',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LtiV1p3GatewayController', () => {
  let controller: LtiV1p3GatewayController;
  let ltiClient: ReturnType<typeof makeLtiClient>;
  let userClient: ReturnType<typeof makeUserClient>;

  beforeEach(async () => {
    ltiClient = makeLtiClient();
    userClient = makeUserClient();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LtiV1p3GatewayController],
      providers: [
        { provide: 'LTI_SERVICE', useValue: ltiClient },
        { provide: 'USER_SERVICE', useValue: userClient },
      ],
    }).compile();

    controller = module.get<LtiV1p3GatewayController>(LtiV1p3GatewayController);
  });

  afterEach(() => jest.clearAllMocks());

  // ── OIDC Login ───────────────────────────────────────────────────────────────

  describe('oidcLoginGet', () => {
    it('redirects to the platform OIDC auth endpoint', async () => {
      const res = makeRes();
      ltiClient.send.mockReturnValue(
        of({
          redirectUrl: 'https://canvas.example.com/auth',
          params: { scope: 'openid', response_type: 'id_token' },
        }),
      );

      await controller.oidcLoginGet(
        { iss: 'https://canvas.example.com', login_hint: 'hint-1' } as any,
        res as any,
      );

      expect(ltiClient.send).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          dto: expect.objectContaining({ iss: 'https://canvas.example.com' }),
        }),
      );
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('https://canvas.example.com/auth'),
      );
    });

    it('returns 400 JSON when OIDC initiation fails', async () => {
      const res = makeRes();
      ltiClient.send.mockReturnValue(throwError(() => new Error('bad issuer')));

      await controller.oidcLoginGet(
        { iss: 'https://evil.example.com' } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'OIDC login failed' }),
      );
    });
  });

  describe('oidcLoginPost', () => {
    it('delegates body params identically to oidcLoginGet', async () => {
      const res = makeRes();
      ltiClient.send.mockReturnValue(
        of({ redirectUrl: 'https://moodle.example.com/auth', params: {} }),
      );

      await controller.oidcLoginPost(
        { iss: 'https://moodle.example.com', client_id: 'cid-1' } as any,
        res as any,
      );

      expect(res.redirect).toHaveBeenCalled();
    });
  });

  // ── LTI 1.3 Launch ───────────────────────────────────────────────────────────

  describe('launch', () => {
    it('redirects to /lti/launch with token, refresh_token, and sessionId on success', async () => {
      const res = makeRes();

      // Call 1: V1P3_LAUNCH  Call 2: SESSION_FIND
      ltiClient.send
        .mockReturnValueOnce(of(DEFAULT_LTI_RESULT))
        .mockReturnValueOnce(of(DEFAULT_LTI_SESSION));
      userClient.send.mockReturnValue(of(DEFAULT_AUTH_RESULT));

      await controller.launch(
        { id_token: 'signed.jwt', state: 'state-xyz' },
        res as any,
      );

      const redirectArg: string = res.redirect.mock.calls[0][0];
      const url = new URL(redirectArg);

      expect(url.pathname).toBe('/lti/launch');
      expect(url.searchParams.get('sessionId')).toBe('lti-session-1');
      expect(url.searchParams.get('token')).toBe('access-jwt');
      expect(url.searchParams.get('refresh_token')).toBe('refresh-jwt');
    });

    it('includes pitchSessionId in redirect when LTI session is already linked', async () => {
      const res = makeRes();

      ltiClient.send
        .mockReturnValueOnce(of(DEFAULT_LTI_RESULT))
        .mockReturnValueOnce(of({ pitchSessionId: 'pitch-sess-99' }));
      userClient.send.mockReturnValue(of(DEFAULT_AUTH_RESULT));

      await controller.launch(
        { id_token: 'signed.jwt', state: 'state-xyz' },
        res as any,
      );

      const redirectArg: string = res.redirect.mock.calls[0][0];
      const url = new URL(redirectArg);
      expect(url.searchParams.get('pitchSessionId')).toBe('pitch-sess-99');
    });

    it('omits pitchSessionId when not yet linked', async () => {
      const res = makeRes();

      ltiClient.send
        .mockReturnValueOnce(of(DEFAULT_LTI_RESULT))
        .mockReturnValueOnce(of({ pitchSessionId: null }));
      userClient.send.mockReturnValue(of(DEFAULT_AUTH_RESULT));

      await controller.launch(
        { id_token: 'signed.jwt', state: 'state-xyz' },
        res as any,
      );

      const redirectArg: string = res.redirect.mock.calls[0][0];
      const url = new URL(redirectArg);
      expect(url.searchParams.has('pitchSessionId')).toBe(false);
    });

    it('redirects without token when LTI user has no email', async () => {
      const res = makeRes();
      const noEmailResult = {
        context: {
          sessionId: 'lti-session-2',
          platformId: 'platform-1',
          user: {},
        },
      };

      ltiClient.send
        .mockReturnValueOnce(of(noEmailResult))
        .mockReturnValueOnce(of(DEFAULT_LTI_SESSION));

      await controller.launch(
        { id_token: 'signed.jwt', state: 'state-xyz' },
        res as any,
      );

      const redirectArg: string = res.redirect.mock.calls[0][0];
      const url = new URL(redirectArg);
      expect(url.pathname).toBe('/lti/launch');
      expect(url.searchParams.has('token')).toBe(false);
      // USER_SERVICE should not have been called at all
      expect(userClient.send).not.toHaveBeenCalled();
    });

    it('still redirects to /lti/launch even when auto-login call fails', async () => {
      const res = makeRes();

      ltiClient.send
        .mockReturnValueOnce(of(DEFAULT_LTI_RESULT))
        .mockReturnValueOnce(of(DEFAULT_LTI_SESSION));
      // auth service failure — should be treated as a warning, not an error
      userClient.send.mockReturnValue(
        throwError(() => new Error('user service down')),
      );

      await controller.launch(
        { id_token: 'signed.jwt', state: 'state-xyz' },
        res as any,
      );

      const redirectArg: string = res.redirect.mock.calls[0][0];
      const url = new URL(redirectArg);
      // Should still redirect to lti/launch, just without token
      expect(url.pathname).toBe('/lti/launch');
      expect(url.searchParams.has('token')).toBe(false);
    });

    it('calls AUTH_LTI_LOGIN with email, name, and sub from LTI claims', async () => {
      const res = makeRes();

      ltiClient.send
        .mockReturnValueOnce(of(DEFAULT_LTI_RESULT))
        .mockReturnValueOnce(of(DEFAULT_LTI_SESSION));
      userClient.send.mockReturnValue(of(DEFAULT_AUTH_RESULT));

      await controller.launch(
        { id_token: 'signed.jwt', state: 'state-xyz' },
        res as any,
      );

      expect(userClient.send).toHaveBeenCalledWith(
        'auth.lti.login',
        expect.objectContaining({
          email: 'learner@university.edu',
          name: 'Alice Learner',
          sub: 'sub-alice',
        }),
      );
    });

    it('redirects to /lti/error when LTI JWT validation fails', async () => {
      const res = makeRes();
      ltiClient.send.mockReturnValue(
        throwError(() => new Error('invalid JWT')),
      );

      await controller.launch(
        { id_token: 'bad.jwt', state: 'state' },
        res as any,
      );

      const redirectArg: string = res.redirect.mock.calls[0][0];
      expect(redirectArg).toContain('/lti/error');
      expect(redirectArg).toContain('reason=launch_failed');
    });

    it('includes platformId in the redirect URL', async () => {
      const res = makeRes();

      ltiClient.send
        .mockReturnValueOnce(of(DEFAULT_LTI_RESULT))
        .mockReturnValueOnce(of(DEFAULT_LTI_SESSION));
      userClient.send.mockReturnValue(of(DEFAULT_AUTH_RESULT));

      await controller.launch(
        { id_token: 'signed.jwt', state: 'state-xyz' },
        res as any,
      );

      const redirectArg: string = res.redirect.mock.calls[0][0];
      const url = new URL(redirectArg);
      expect(url.searchParams.get('platformId')).toBe('platform-1');
    });
  });

  // ── JWKS ─────────────────────────────────────────────────────────────────────

  describe('getJwks', () => {
    it('returns the JWKS from the LTI microservice', async () => {
      const mockJwks = {
        keys: [{ kty: 'RSA', kid: 'pitch-lti-key-1', use: 'sig' }],
      };
      ltiClient.send.mockReturnValue(of(mockJwks));

      const result = await controller.getJwks();

      expect(result).toEqual(mockJwks);
    });
  });
});
