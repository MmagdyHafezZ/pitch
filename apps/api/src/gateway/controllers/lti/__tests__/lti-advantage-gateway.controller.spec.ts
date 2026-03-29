import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import type { ClientProxy } from '@nestjs/microservices';
import { LtiAdvantageGatewayController } from '../lti-advantage-gateway.controller';
import { LTI_PATTERNS } from '@microservices/lti/common/constants/lti-patterns.constants';
import type { Response } from 'express';

const createClientProxyMock = (): jest.Mocked<
  Pick<ClientProxy, 'send' | 'emit'>
> => ({
  send: jest.fn(),
  emit: jest.fn(),
});

const createResMock = (): jest.Mocked<
  Pick<Response, 'setHeader' | 'send' | 'status'>
> & {
  status: jest.Mock;
} => ({
  setHeader: jest.fn(),
  send: jest.fn(),
  status: jest.fn().mockReturnThis(),
});

describe('LtiAdvantageGatewayController', () => {
  let controller: LtiAdvantageGatewayController;
  let ltiClient: ReturnType<typeof createClientProxyMock>;

  beforeEach(async () => {
    ltiClient = createClientProxyMock();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LtiAdvantageGatewayController],
      providers: [{ provide: 'LTI_SERVICE', useValue: ltiClient }],
    }).compile();

    controller = module.get(LtiAdvantageGatewayController);
  });

  afterEach(() => jest.clearAllMocks());

  // ── deepLink ──────────────────────────────────────────────────────────────

  describe('deepLink()', () => {
    const dto = { sessionId: 'sess-1', contentItems: [] } as any;

    it('sends DEEP_LINK_RESPONSE to lti service and returns an HTML auto-submit page', async () => {
      const returnUrl = 'https://lms.example.com/return';
      const jwt = 'signed-jwt-token';
      ltiClient.send.mockReturnValue(of({ jwt, returnUrl }));

      const res = createResMock() as unknown as Response;
      await controller.deepLink(dto, res);

      expect(ltiClient.send).toHaveBeenCalledWith(
        LTI_PATTERNS.DEEP_LINK_RESPONSE,
        dto,
      );
      expect((res as any).setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/html',
      );
      const sentHtml: string = (res as any).send.mock.calls[0][0] as string;
      expect(sentHtml).toContain('lti_form');
      expect(sentHtml).toContain(returnUrl);
      expect(sentHtml).toContain(jwt);
    });

    it('escapes HTML special characters in returnUrl and jwt attribute values', async () => {
      const returnUrl = 'https://lms.example.com/return?a=1&b=2';
      const jwt = '"<xss>alert(1)</xss>"';
      ltiClient.send.mockReturnValue(of({ jwt, returnUrl }));

      const res = createResMock() as unknown as Response;
      await controller.deepLink(dto, res);

      const sentHtml: string = (res as any).send.mock.calls[0][0] as string;
      // The page intentionally contains a <script> tag for form auto-submit —
      // verify the injected JWT value itself is escaped in the attribute context.
      expect(sentHtml).toContain('&amp;'); // & from returnUrl
      expect(sentHtml).toContain('&quot;'); // " from jwt
      expect(sentHtml).toContain('&lt;'); // < from jwt
      expect(sentHtml).toContain('&gt;'); // > from jwt
      // The raw unescaped tag must NOT appear inside the JWT value attribute
      expect(sentHtml).not.toContain('value="<xss>');
    });

    it('propagates errors from lti service', async () => {
      ltiClient.send.mockReturnValue(
        throwError(() => new Error('deep-link failed')),
      );
      const res = createResMock() as unknown as Response;

      await expect(controller.deepLink(dto, res)).rejects.toThrow(
        'deep-link failed',
      );
    });
  });

  // ── getMembers ────────────────────────────────────────────────────────────

  describe('getMembers()', () => {
    it('sends NRPS_GET_MEMBERS with sessionId and returns members', async () => {
      const members = [{ userId: 'u1', roles: ['Learner'] }];
      ltiClient.send.mockReturnValue(of(members));

      const result = await controller.getMembers('session-abc');

      expect(ltiClient.send).toHaveBeenCalledWith(
        LTI_PATTERNS.NRPS_GET_MEMBERS,
        { sessionId: 'session-abc' },
      );
      expect(result).toEqual(members);
    });

    it('propagates errors from lti service', async () => {
      ltiClient.send.mockReturnValue(throwError(() => new Error('nrps error')));

      await expect(controller.getMembers('session-abc')).rejects.toThrow(
        'nrps error',
      );
    });
  });

  // ── createLineItem ────────────────────────────────────────────────────────

  describe('createLineItem()', () => {
    const dto = { label: 'Assignment 1', scoreMaximum: 100 } as any;

    it('sends AGS_CREATE_LINE_ITEM and returns created line item', async () => {
      const lineItem = { id: 'li-1', label: 'Assignment 1' };
      ltiClient.send.mockReturnValue(of(lineItem));

      const result = await controller.createLineItem(dto);

      expect(ltiClient.send).toHaveBeenCalledWith(
        LTI_PATTERNS.AGS_CREATE_LINE_ITEM,
        dto,
      );
      expect(result).toEqual(lineItem);
    });

    it('propagates errors from lti service', async () => {
      ltiClient.send.mockReturnValue(throwError(() => new Error('ags error')));

      await expect(controller.createLineItem(dto)).rejects.toThrow('ags error');
    });
  });

  // ── getLineItems ──────────────────────────────────────────────────────────

  describe('getLineItems()', () => {
    it('sends AGS_GET_LINE_ITEMS with sessionId and returns line items', async () => {
      const lineItems = [{ id: 'li-1' }, { id: 'li-2' }];
      ltiClient.send.mockReturnValue(of(lineItems));

      const result = await controller.getLineItems('sess-xyz');

      expect(ltiClient.send).toHaveBeenCalledWith(
        LTI_PATTERNS.AGS_GET_LINE_ITEMS,
        { sessionId: 'sess-xyz' },
      );
      expect(result).toEqual(lineItems);
    });

    it('propagates errors from lti service', async () => {
      ltiClient.send.mockReturnValue(
        throwError(() => new Error('line items error')),
      );

      await expect(controller.getLineItems('sess-xyz')).rejects.toThrow(
        'line items error',
      );
    });
  });

  // ── submitScore ───────────────────────────────────────────────────────────

  describe('submitScore()', () => {
    const dto = { lineItemId: 'li-1', scoreGiven: 85, userId: 'u1' } as any;

    it('sends AGS_SUBMIT_SCORE and returns result', async () => {
      const response = { success: true };
      ltiClient.send.mockReturnValue(of(response));

      const result = await controller.submitScore(dto);

      expect(ltiClient.send).toHaveBeenCalledWith(
        LTI_PATTERNS.AGS_SUBMIT_SCORE,
        dto,
      );
      expect(result).toEqual(response);
    });

    it('propagates errors from lti service', async () => {
      ltiClient.send.mockReturnValue(
        throwError(() => new Error('score error')),
      );

      await expect(controller.submitScore(dto)).rejects.toThrow('score error');
    });
  });

  // ── getResults ────────────────────────────────────────────────────────────

  describe('getResults()', () => {
    const dto = { lineItemId: 'li-1', sessionId: 'sess-1' } as any;

    it('sends AGS_GET_RESULTS and returns grade results', async () => {
      const results = [{ userId: 'u1', resultScore: 85 }];
      ltiClient.send.mockReturnValue(of(results));

      const result = await controller.getResults(dto);

      expect(ltiClient.send).toHaveBeenCalledWith(
        LTI_PATTERNS.AGS_GET_RESULTS,
        dto,
      );
      expect(result).toEqual(results);
    });

    it('propagates errors from lti service', async () => {
      ltiClient.send.mockReturnValue(
        throwError(() => new Error('results error')),
      );

      await expect(controller.getResults(dto)).rejects.toThrow('results error');
    });
  });
});
