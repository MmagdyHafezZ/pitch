import { PhoneCallController } from '../../phone/phone.controller';
import { PhoneCallService } from '../../phone/phone-call.service';

jest.mock('@pitch/shared-backend/helpers/exceptions', () => ({
  toRpcException: jest.fn((err) => err),
}));

function makeService(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    startCall: overrides.startCall ?? jest.fn(),
    endActiveCall: overrides.endActiveCall ?? jest.fn(),
  } as unknown as PhoneCallService;
}

describe('PhoneCallController', () => {
  describe('startCall', () => {
    it('delegates to phoneCallService.startCall with userId from claims', async () => {
      const expected = { callId: 'call-1', status: 'initiated' };
      const startCall = jest.fn().mockResolvedValue(expected);
      const service = makeService({ startCall });
      const controller = new PhoneCallController(service);

      const result = await controller.startCall({
        sessionId: 'sess-1',
        phoneNumber: '+15551234567',
        userClaims: { id: 'user-1', email: 'a@b.com', name: 'Alice' },
      } as any);

      expect(startCall).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'sess-1',
          phoneNumber: '+15551234567',
          userId: 'user-1',
        }),
      );
      expect(result).toEqual(expected);
    });

    it('throws when userClaims.id is missing', async () => {
      const service = makeService();
      const controller = new PhoneCallController(service);

      await expect(
        controller.startCall({
          sessionId: 'sess-1',
          userClaims: { email: 'a@b.com' },
        } as any),
      ).rejects.toThrow('User claims are required');
    });

    it('throws when userClaims is undefined', async () => {
      const service = makeService();
      const controller = new PhoneCallController(service);

      await expect(
        controller.startCall({ sessionId: 'sess-1' } as any),
      ).rejects.toThrow();
    });

    it('rethrows service errors', async () => {
      const startCall = jest.fn().mockRejectedValue(new Error('call failed'));
      const service = makeService({ startCall });
      const controller = new PhoneCallController(service);

      await expect(
        controller.startCall({
          sessionId: 'sess-1',
          userClaims: { id: 'user-1', email: 'a@b.com', name: 'Alice' },
        } as any),
      ).rejects.toThrow('call failed');
    });
  });

  describe('endCall', () => {
    it('delegates to phoneCallService.endActiveCall with userId', async () => {
      const expected = { status: 'ended' };
      const endActiveCall = jest.fn().mockResolvedValue(expected);
      const service = makeService({ endActiveCall });
      const controller = new PhoneCallController(service);

      const result = await controller.endCall({
        sessionId: 'sess-1',
        userClaims: { id: 'user-1', email: 'a@b.com', name: 'Bob' },
      } as any);

      expect(endActiveCall).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'sess-1',
          userId: 'user-1',
        }),
      );
      expect(result).toEqual(expected);
    });

    it('throws when userClaims.id is missing', async () => {
      const service = makeService();
      const controller = new PhoneCallController(service);

      await expect(
        controller.endCall({
          sessionId: 'sess-1',
          userClaims: {},
        } as any),
      ).rejects.toThrow('User claims are required');
    });

    it('rethrows service errors', async () => {
      const endActiveCall = jest
        .fn()
        .mockRejectedValue(new Error('end failed'));
      const service = makeService({ endActiveCall });
      const controller = new PhoneCallController(service);

      await expect(
        controller.endCall({
          sessionId: 'sess-1',
          userClaims: { id: 'user-1', email: 'a@b.com', name: 'Bob' },
        } as any),
      ).rejects.toThrow('end failed');
    });
  });
});
