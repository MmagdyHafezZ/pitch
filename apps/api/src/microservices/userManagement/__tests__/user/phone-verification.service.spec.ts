import { ConflictException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { createHash } from 'crypto';
import { PhoneVerificationStatus as VerificationStatusRecord } from '@prisma/user-client';
import { PhoneVerificationService } from '../../user/services/phone-verification.service';

type PrismaMock = {
  user: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
  };
  client: {
    phoneVerificationChallenge: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    user: {
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
};

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

describe('PhoneVerificationService', () => {
  let service: PhoneVerificationService;
  let prisma: PrismaMock;
  let configService: jest.Mocked<ConfigService>;

  const configValues: Record<string, string> = {
    TWILIO_ACCOUNT_SID: 'AC1234567890abcdef1234567890abcd',
    TWILIO_AUTH_TOKEN: 'twilio-auth-token',
    TWILIO_FROM_NUMBER: '+17822026330',
    PHONE_VERIFICATION_CODE_SECRET: 'verify-secret',
    PHONE_VERIFICATION_CODE_TTL_MINUTES: '10',
    PHONE_VERIFICATION_RESEND_COOLDOWN_SECONDS: '30',
    PHONE_VERIFICATION_MAX_ATTEMPTS: '5',
    PHONE_VERIFICATION_MAX_SENDS: '3',
  };

  const baseUser = {
    id: 'user-1',
    phoneNumber: null,
    phoneVerifiedAt: null,
  };

  const createPendingChallenge = (overrides: Record<string, unknown> = {}) => ({
    id: 'challenge-1',
    userId: 'user-1',
    phoneNumber: '+15551234567',
    codeHash: hashCode('123456'),
    status: VerificationStatusRecord.pending,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    lastSentAt: new Date(Date.now() - 60 * 1000),
    sendCount: 1,
    attemptCount: 0,
    verifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const hashCode = (code: string) =>
    createHash('sha256')
      .update(`${configValues.PHONE_VERIFICATION_CODE_SECRET}:${code}`)
      .digest('hex');

  beforeEach(() => {
    mockAxios.post.mockResolvedValue({
      data: {
        sid: 'SM1234567890abcdef1234567890abcdef',
        status: 'queued',
      },
    });

    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      client: {
        phoneVerificationChallenge: {
          findFirst: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          updateMany: jest.fn(),
        },
        user: {
          update: jest.fn(),
        },
        $transaction: jest.fn(async (operations: Array<Promise<unknown>>) =>
          Promise.all(operations),
        ),
      },
    };

    configService = {
      get: jest.fn((key: string) => configValues[key]),
    } as unknown as jest.Mocked<ConfigService>;

    service = new PhoneVerificationService(
      prisma as any,
      configService as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('requests a verification SMS for a normalized phone number', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(baseUser as any)
      .mockResolvedValueOnce(baseUser as any);
    prisma.user.findFirst.mockResolvedValue(null as any);
    prisma.client.phoneVerificationChallenge.findFirst
      .mockResolvedValueOnce(null as any)
      .mockResolvedValueOnce({
        id: 'challenge-1',
        userId: 'user-1',
        phoneNumber: '+15551234567',
        codeHash: hashCode('123456'),
        status: VerificationStatusRecord.pending,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        lastSentAt: new Date(Date.now() - 60 * 1000),
        sendCount: 1,
        attemptCount: 0,
        verifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
    prisma.client.phoneVerificationChallenge.create.mockResolvedValue({
      id: 'challenge-1',
    } as any);

    const status = await service.requestVerification(
      'user-1',
      '(555) 123-4567',
    );

    expect(
      prisma.client.phoneVerificationChallenge.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          phoneNumber: '+15551234567',
        }),
      }),
    );
    expect(mockAxios.post).toHaveBeenCalledTimes(1);
    expect(status).toEqual(
      expect.objectContaining({
        verified: false,
        pendingPhoneNumber: '+15551234567',
      }),
    );
  });

  it('returns existing verified status when the same verified number is requested again', async () => {
    const verifiedUser = {
      ...baseUser,
      phoneNumber: '+15551234567',
      phoneVerifiedAt: new Date('2024-01-01T00:00:00.000Z'),
    };
    prisma.user.findUnique
      .mockResolvedValueOnce(verifiedUser as any)
      .mockResolvedValueOnce(verifiedUser as any);
    prisma.client.phoneVerificationChallenge.findFirst.mockResolvedValue(
      null as any,
    );

    const status = await service.requestVerification('user-1', '+15551234567');

    expect(status).toEqual(
      expect.objectContaining({
        verified: true,
        phoneNumber: '+15551234567',
      }),
    );
    expect(
      prisma.client.phoneVerificationChallenge.create,
    ).not.toHaveBeenCalled();
    expect(mockAxios.post).not.toHaveBeenCalled();
  });

  it('expires stale pending challenges when reading status', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser as any);
    prisma.client.phoneVerificationChallenge.findFirst.mockResolvedValue(
      createPendingChallenge({
        expiresAt: new Date(Date.now() - 60 * 1000),
      }) as any,
    );
    prisma.client.phoneVerificationChallenge.update.mockResolvedValue({
      id: 'challenge-1',
      status: VerificationStatusRecord.expired,
    } as any);

    const status = await service.getStatus('user-1');

    expect(
      prisma.client.phoneVerificationChallenge.update,
    ).toHaveBeenCalledWith({
      where: { id: 'challenge-1' },
      data: { status: VerificationStatusRecord.expired },
    });
    expect(status.pendingPhoneNumber).toBeNull();
  });

  it('cancels the previous pending challenge when a different number is requested', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(baseUser as any)
      .mockResolvedValueOnce(baseUser as any);
    prisma.user.findFirst.mockResolvedValue(null as any);
    prisma.client.phoneVerificationChallenge.findFirst
      .mockResolvedValueOnce(
        createPendingChallenge({
          id: 'challenge-old',
          phoneNumber: '+15550001111',
        }) as any,
      )
      .mockResolvedValueOnce(
        createPendingChallenge({
          id: 'challenge-new',
          phoneNumber: '+15557654321',
        }) as any,
      );
    prisma.client.phoneVerificationChallenge.update
      .mockResolvedValueOnce({
        id: 'challenge-old',
        status: VerificationStatusRecord.cancelled,
      } as any)
      .mockResolvedValueOnce({
        id: 'challenge-new',
        status: VerificationStatusRecord.pending,
      } as any);
    prisma.client.phoneVerificationChallenge.create.mockResolvedValue({
      id: 'challenge-new',
    } as any);

    const status = await service.requestVerification('user-1', '+15557654321');

    expect(
      prisma.client.phoneVerificationChallenge.update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'challenge-old' },
        data: { status: VerificationStatusRecord.cancelled },
      }),
    );
    expect(status.pendingPhoneNumber).toBe('+15557654321');
  });

  it('cancels a challenge if delivery fails', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser as any);
    prisma.user.findFirst.mockResolvedValue(null as any);
    prisma.client.phoneVerificationChallenge.findFirst.mockResolvedValue(
      null as any,
    );
    prisma.client.phoneVerificationChallenge.create.mockResolvedValue({
      id: 'challenge-1',
    } as any);
    prisma.client.phoneVerificationChallenge.update.mockResolvedValue({
      id: 'challenge-1',
      status: VerificationStatusRecord.cancelled,
    } as any);
    mockAxios.post.mockRejectedValue(new Error('delivery failed'));

    await expect(
      service.requestVerification('user-1', '+15551234567'),
    ).rejects.toThrow('delivery failed');

    expect(
      prisma.client.phoneVerificationChallenge.update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'challenge-1' },
        data: { status: VerificationStatusRecord.cancelled },
      }),
    );
  });

  it('verifies a correct code and persists the verified phone number', async () => {
    const pendingChallenge = createPendingChallenge();

    prisma.client.phoneVerificationChallenge.findFirst
      .mockResolvedValueOnce(pendingChallenge as any)
      .mockResolvedValueOnce(null as any);
    prisma.user.findFirst.mockResolvedValue(null as any);
    prisma.client.user.update.mockResolvedValue({
      ...baseUser,
      phoneNumber: '+15551234567',
      phoneVerifiedAt: new Date('2024-01-01T00:00:00.000Z'),
    } as any);
    prisma.client.phoneVerificationChallenge.update.mockResolvedValue({
      ...pendingChallenge,
      status: VerificationStatusRecord.verified,
    } as any);
    prisma.client.phoneVerificationChallenge.updateMany.mockResolvedValue({
      count: 0,
    } as any);
    prisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      phoneNumber: '+15551234567',
      phoneVerifiedAt: new Date('2024-01-01T00:00:00.000Z'),
    } as any);

    const status = await service.verifyCode('user-1', '123456');

    expect(prisma.client.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          phoneNumber: '+15551234567',
          phoneVerifiedAt: expect.any(Date),
        }),
      }),
    );
    expect(status).toEqual(
      expect.objectContaining({
        verified: true,
        phoneNumber: '+15551234567',
      }),
    );
  });

  it('rejects duplicate verified phone numbers', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser as any);
    prisma.user.findFirst.mockResolvedValue({ id: 'user-2' } as any);

    await expect(
      service.requestVerification('user-1', '+15551234567'),
    ).rejects.toThrow(ConflictException);
  });

  it('resends verification with a fresh code and reset attempts', async () => {
    prisma.client.phoneVerificationChallenge.findFirst
      .mockResolvedValueOnce(
        createPendingChallenge({
          attemptCount: 4,
        }) as any,
      )
      .mockResolvedValueOnce(
        createPendingChallenge({
          attemptCount: 0,
          sendCount: 2,
        }) as any,
      );
    prisma.client.phoneVerificationChallenge.update.mockResolvedValue({
      id: 'challenge-1',
      status: VerificationStatusRecord.pending,
      sendCount: 2,
      attemptCount: 0,
    } as any);
    prisma.user.findUnique.mockResolvedValue(baseUser as any);

    const status = await service.resendVerification('user-1');

    expect(
      prisma.client.phoneVerificationChallenge.update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'challenge-1' },
        data: expect.objectContaining({
          attemptCount: 0,
          sendCount: 2,
          codeHash: expect.any(String),
        }),
      }),
    );
    expect(status.remainingAttempts).toBe(5);
    expect(mockAxios.post).toHaveBeenCalledTimes(1);
  });

  it('enforces resend cooldown before sending another code', async () => {
    prisma.client.phoneVerificationChallenge.findFirst.mockResolvedValue(
      createPendingChallenge({
        lastSentAt: new Date(),
      }) as any,
    );

    let thrown: HttpException | null = null;
    try {
      await service.resendVerification('user-1');
    } catch (error) {
      thrown = error as HttpException;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect(thrown?.message).toBe(
      'Please wait 30 seconds before requesting another code.',
    );
    expect(thrown?.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(mockAxios.post).not.toHaveBeenCalled();
  });

  it('rejects invalid verification code format before comparing hashes', async () => {
    prisma.client.phoneVerificationChallenge.findFirst.mockResolvedValue(
      createPendingChallenge() as any,
    );

    await expect(service.verifyCode('user-1', '12ab')).rejects.toThrow(
      'Verification code must be 6 digits.',
    );

    expect(
      prisma.client.phoneVerificationChallenge.update,
    ).not.toHaveBeenCalled();
  });

  it('increments attempts and reports remaining tries for an incorrect code', async () => {
    prisma.client.phoneVerificationChallenge.findFirst.mockResolvedValue(
      createPendingChallenge({
        attemptCount: 1,
      }) as any,
    );
    prisma.client.phoneVerificationChallenge.update.mockResolvedValue({
      id: 'challenge-1',
      attemptCount: 2,
    } as any);

    await expect(service.verifyCode('user-1', '654321')).rejects.toThrow(
      'Verification code is incorrect. 3 attempts remaining.',
    );

    expect(
      prisma.client.phoneVerificationChallenge.update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'challenge-1' },
        data: expect.objectContaining({
          attemptCount: 2,
        }),
      }),
    );
  });

  it('expires the challenge on the final incorrect code attempt', async () => {
    prisma.client.phoneVerificationChallenge.findFirst.mockResolvedValue(
      createPendingChallenge({
        attemptCount: 4,
      }) as any,
    );
    prisma.client.phoneVerificationChallenge.update.mockResolvedValue({
      id: 'challenge-1',
      status: VerificationStatusRecord.expired,
      attemptCount: 5,
    } as any);

    await expect(service.verifyCode('user-1', '654321')).rejects.toThrow(
      'Verification code expired. Request a new code.',
    );

    expect(
      prisma.client.phoneVerificationChallenge.update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'challenge-1' },
        data: expect.objectContaining({
          attemptCount: 5,
          status: VerificationStatusRecord.expired,
        }),
      }),
    );
  });

  it('rate limits when attempts are already exhausted', async () => {
    prisma.client.phoneVerificationChallenge.findFirst.mockResolvedValue(
      createPendingChallenge({
        attemptCount: 5,
      }) as any,
    );
    prisma.client.phoneVerificationChallenge.update.mockResolvedValue({
      id: 'challenge-1',
      status: VerificationStatusRecord.expired,
    } as any);

    await expect(service.verifyCode('user-1', '123456')).rejects.toThrow(
      'Too many verification attempts. Request a new code.',
    );

    expect(
      prisma.client.phoneVerificationChallenge.update,
    ).toHaveBeenCalledWith({
      where: { id: 'challenge-1' },
      data: { status: VerificationStatusRecord.expired },
    });
  });

  it('validates startup config for verification delivery', () => {
    const brokenConfig = {
      get: jest.fn((key: string) =>
        key === 'TWILIO_FROM_NUMBER' ? undefined : configValues[key],
      ),
    } as unknown as ConfigService;
    const brokenService = new PhoneVerificationService(
      prisma as any,
      brokenConfig,
    );

    expect(() => brokenService.onModuleInit()).toThrow(
      'TWILIO_FROM_NUMBER is required for phone verification SMS.',
    );
  });
});
