import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import type { ClientProxy } from '@nestjs/microservices';
import { LtiV1p1GatewayController } from '../lti-v1.1-gateway.controller';
import { LTI_PATTERNS } from '@microservices/lti/common/constants/lti-patterns.constants';
import type { Request, Response } from 'express';

const createClientProxyMock = (): jest.Mocked<
  Pick<ClientProxy, 'send' | 'emit'>
> => ({
  send: jest.fn(),
  emit: jest.fn(),
});

const createReqMock = (overrides: Partial<Request> = {}): Partial<Request> => ({
  protocol: 'https',
  get: jest.fn().mockReturnValue('lms.example.com'),
  originalUrl: '/api/v1/lti/v1.1/launch',
  method: 'POST',
  ...overrides,
});

const createResMock = () => ({
  redirect: jest.fn(),
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

describe('LtiV1p1GatewayController', () => {
  let controller: LtiV1p1GatewayController;
  let ltiClient: ReturnType<typeof createClientProxyMock>;

  beforeEach(async () => {
    ltiClient = createClientProxyMock();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LtiV1p1GatewayController],
      providers: [{ provide: 'LTI_SERVICE', useValue: ltiClient }],
    }).compile();

    controller = module.get(LtiV1p1GatewayController);
  });

  afterEach(() => jest.clearAllMocks());

  // ── launch ────────────────────────────────────────────────────────────────

  describe('launch()', () => {
    const body: Record<string, string> = {
      lti_message_type: 'basic-lti-launch-request',
      lti_version: 'LTI-1p0',
      oauth_consumer_key: 'key-123',
    };

    it('forwards the launch body and URL to lti service then redirects', async () => {
      ltiClient.send.mockReturnValue(of({ sessionId: 'sess-lti-1' }));

      const req = createReqMock();
      const res = createResMock();

      await controller.launch(body, req as Request, res as unknown as Response);

      expect(ltiClient.send).toHaveBeenCalledWith(
        LTI_PATTERNS.V1P1_LAUNCH,
        expect.objectContaining({
          dto: body,
          requestUrl: expect.stringContaining('lms.example.com'),
          method: 'POST',
        }),
      );

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('sessionId=sess-lti-1'),
      );
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('version=1.1'),
      );
    });

    it('uses the pitchAppUrl already set on the controller instance for the redirect URL', async () => {
      // pitchAppUrl is set at construction time from process.env.PITCH_APP_URL.
      // We verify the redirect goes to whatever the controller's pitchAppUrl is.
      ltiClient.send.mockReturnValue(of({ sessionId: 'sess-lti-2' }));

      const req = createReqMock();
      const res = createResMock();

      await controller.launch(body, req as Request, res as unknown as Response);

      const redirectArg: string = (res.redirect as jest.Mock).mock
        .calls[0][0] as string;
      expect(redirectArg).toMatch(
        /\/lti\/launch\?sessionId=sess-lti-2&version=1\.1/,
      );
    });

    it('returns 400 JSON response when lti service throws', async () => {
      ltiClient.send.mockReturnValue(
        throwError(() => new Error('OAuth signature invalid')),
      );

      const req = createReqMock();
      const res = createResMock();

      await controller.launch(body, req as Request, res as unknown as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'LTI 1.1 launch failed',
          message: 'OAuth signature invalid',
        }),
      );
    });

    it('reconstructs the full request URL from req.protocol, host and originalUrl', async () => {
      ltiClient.send.mockReturnValue(of({ sessionId: 'sess-lti-3' }));

      const req = createReqMock({
        protocol: 'http',
        get: jest.fn().mockReturnValue('myhost:4000'),
        originalUrl: '/api/v1/lti/v1.1/launch?foo=bar',
      });
      const res = createResMock();

      await controller.launch(body, req as Request, res as unknown as Response);

      expect(ltiClient.send).toHaveBeenCalledWith(
        LTI_PATTERNS.V1P1_LAUNCH,
        expect.objectContaining({
          requestUrl: 'http://myhost:4000/api/v1/lti/v1.1/launch?foo=bar',
        }),
      );
    });
  });
});
