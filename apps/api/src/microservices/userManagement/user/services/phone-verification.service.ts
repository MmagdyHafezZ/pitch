import {
  BadRequestException,
  ConflictException,
  Inject,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { PhoneVerificationStatus as VerificationStatusRecord } from '@prisma/user-client';
import type { PhoneVerificationStatus } from '@pitch/shared-backend/interfaces/user.interface';
import { UserPrismaService } from '../../prisma/user-prisma.service';
import { VERIFICATION_SMS_SENDER } from './providers/verification-sms.provider';
import type { VerificationSmsSender } from './providers/verification-sms.provider';

type PendingChallenge = {
  id: string;
  phoneNumber: string;
  codeHash: string;
  status: VerificationStatusRecord;
  expiresAt: Date;
  lastSentAt: Date;
  sendCount: number;
  attemptCount: number;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
};

@Injectable()
export class PhoneVerificationService implements OnModuleInit {
  private readonly logger = new Logger(PhoneVerificationService.name);

  constructor(
    private readonly prisma: UserPrismaService,
    private readonly configService: ConfigService,
    @Inject(VERIFICATION_SMS_SENDER)
    private readonly smsSender: VerificationSmsSender,
  ) {}

  onModuleInit() {
    this.smsSender.assertConfigured();
    this.getVerificationSecret();
  }

  async getStatus(userId: string): Promise<PhoneVerificationStatus> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phoneNumber: true,
        phoneVerifiedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const pending = await this.getActivePendingChallenge(userId);
    const temporaryVerified = await this.getLatestTemporaryVerifiedChallenge(
      userId,
      user.phoneNumber ?? null,
    );

    return {
      verified: Boolean(user.phoneNumber && user.phoneVerifiedAt),
      phoneNumber: user.phoneNumber ?? null,
      verifiedAt: user.phoneVerifiedAt ?? null,
      temporaryVerifiedPhoneNumber: temporaryVerified?.phoneNumber ?? null,
      temporaryVerifiedAt: temporaryVerified?.verifiedAt ?? null,
      pendingPhoneNumber: pending?.phoneNumber ?? null,
      pendingExpiresAt: pending?.expiresAt ?? null,
      resendAvailableAt: pending
        ? new Date(pending.lastSentAt.getTime() + this.getResendCooldownMs())
        : null,
      remainingAttempts: pending
        ? Math.max(0, this.getMaxAttempts() - pending.attemptCount)
        : undefined,
      remainingSends: pending
        ? Math.max(0, this.getMaxSends() - pending.sendCount)
        : undefined,
    };
  }

  async requestVerification(
    userId: string,
    rawPhoneNumber: string,
  ): Promise<PhoneVerificationStatus> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phoneNumber: true,
        phoneVerifiedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const phoneNumber = this.normalizePhoneNumber(rawPhoneNumber);

    if (user.phoneNumber === phoneNumber && user.phoneVerifiedAt) {
      return this.getStatus(userId);
    }

    await this.assertNumberIsAvailable(phoneNumber, userId);

    const now = new Date();
    const pending = await this.getActivePendingChallenge(userId);
    const code = this.generateCode();
    const expiresAt = new Date(now.getTime() + this.getCodeTtlMs());

    let challengeId: string;

    if (pending && pending.phoneNumber === phoneNumber) {
      this.assertCanSend(pending, now);
      const updated =
        await this.prisma.client.phoneVerificationChallenge.update({
          where: { id: pending.id },
          data: {
            codeHash: this.hashCode(code),
            expiresAt,
            lastSentAt: now,
            sendCount: pending.sendCount + 1,
            attemptCount: 0,
          },
        });
      challengeId = updated.id;
    } else {
      if (pending) {
        await this.prisma.client.phoneVerificationChallenge.update({
          where: { id: pending.id },
          data: { status: VerificationStatusRecord.cancelled },
        });
      }

      const created =
        await this.prisma.client.phoneVerificationChallenge.create({
          data: {
            userId,
            phoneNumber,
            codeHash: this.hashCode(code),
            expiresAt,
            lastSentAt: now,
          },
        });
      challengeId = created.id;
    }

    try {
      await this.sendVerificationSms(phoneNumber, code, userId);
      this.logger.log(
        `phone_verification.requested user=${userId} phone=${this.maskPhone(phoneNumber)} challenge=${challengeId}`,
      );
    } catch (error) {
      await this.prisma.client.phoneVerificationChallenge.update({
        where: { id: challengeId },
        data: { status: VerificationStatusRecord.cancelled },
      });
      throw error;
    }

    return this.getStatus(userId);
  }

  async resendVerification(userId: string): Promise<PhoneVerificationStatus> {
    const pending = await this.getActivePendingChallenge(userId);
    if (!pending) {
      throw new BadRequestException('No pending phone verification exists');
    }

    const now = new Date();
    this.assertCanSend(pending, now);
    const code = this.generateCode();
    const expiresAt = new Date(now.getTime() + this.getCodeTtlMs());

    await this.prisma.client.phoneVerificationChallenge.update({
      where: { id: pending.id },
      data: {
        codeHash: this.hashCode(code),
        expiresAt,
        lastSentAt: now,
        sendCount: pending.sendCount + 1,
        attemptCount: 0,
      },
    });

    await this.sendVerificationSms(pending.phoneNumber, code, userId);

    this.logger.log(
      `phone_verification.resent user=${userId} phone=${this.maskPhone(pending.phoneNumber)} challenge=${pending.id}`,
    );

    return this.getStatus(userId);
  }

  async verifyCode(
    userId: string,
    rawCode: string,
    saveForFutureUse = true,
  ): Promise<PhoneVerificationStatus> {
    const pending = await this.getActivePendingChallenge(userId);
    if (!pending) {
      throw new BadRequestException('No pending phone verification exists');
    }

    const code = this.normalizeCode(rawCode);

    if (pending.attemptCount >= this.getMaxAttempts()) {
      await this.expireChallenge(pending.id);
      throw this.rateLimitException(
        'Too many verification attempts. Request a new code.',
      );
    }

    const isValid = this.hashMatches(code, pending.codeHash);
    if (!isValid) {
      const nextAttemptCount = pending.attemptCount + 1;

      await this.prisma.client.phoneVerificationChallenge.update({
        where: { id: pending.id },
        data: {
          attemptCount: nextAttemptCount,
          ...(nextAttemptCount >= this.getMaxAttempts()
            ? { status: VerificationStatusRecord.expired }
            : {}),
        },
      });
      throw new UnauthorizedException(
        nextAttemptCount >= this.getMaxAttempts()
          ? 'Verification code expired. Request a new code.'
          : `Verification code is incorrect. ${Math.max(
              0,
              this.getMaxAttempts() - nextAttemptCount,
            )} attempts remaining.`,
      );
    }

    await this.assertNumberIsAvailable(pending.phoneNumber, userId);

    const verifiedAt = new Date();
    await this.prisma.client.$transaction(async (tx) => {
      if (saveForFutureUse) {
        await tx.user.update({
          where: { id: userId },
          data: {
            phoneNumber: pending.phoneNumber,
            phoneVerifiedAt: verifiedAt,
          },
        });
      }

      await tx.phoneVerificationChallenge.update({
        where: { id: pending.id },
        data: {
          status: VerificationStatusRecord.verified,
          verifiedAt,
          attemptCount: pending.attemptCount + 1,
        },
      });

      await tx.phoneVerificationChallenge.updateMany({
        where: {
          userId,
          status: VerificationStatusRecord.pending,
          NOT: { id: pending.id },
        },
        data: { status: VerificationStatusRecord.cancelled },
      });
    });

    this.logger.log(
      `phone_verification.verified user=${userId} phone=${this.maskPhone(pending.phoneNumber)} challenge=${pending.id} saved=${saveForFutureUse}`,
    );

    return this.getStatus(userId);
  }

  async getVerifiedPhoneNumber(userId: string): Promise<string | null> {
    const status = await this.getStatus(userId);
    return status.verified ? (status.phoneNumber ?? null) : null;
  }

  private async getActivePendingChallenge(
    userId: string,
  ): Promise<PendingChallenge | null> {
    const pending =
      await this.prisma.client.phoneVerificationChallenge.findFirst({
        where: {
          userId,
          status: VerificationStatusRecord.pending,
        },
        orderBy: { createdAt: 'desc' },
      });

    if (!pending) {
      return null;
    }

    if (pending.expiresAt.getTime() <= Date.now()) {
      await this.expireChallenge(pending.id);
      return null;
    }

    return pending;
  }

  private async getLatestTemporaryVerifiedChallenge(
    userId: string,
    savedPhoneNumber: string | null,
  ): Promise<PendingChallenge | null> {
    return await this.prisma.client.phoneVerificationChallenge.findFirst({
      where: {
        userId,
        status: VerificationStatusRecord.verified,
        ...(savedPhoneNumber
          ? {
              NOT: {
                phoneNumber: savedPhoneNumber,
              },
            }
          : {}),
      },
      orderBy: [{ verifiedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  private async expireChallenge(challengeId: string): Promise<void> {
    await this.prisma.client.phoneVerificationChallenge.update({
      where: { id: challengeId },
      data: { status: VerificationStatusRecord.expired },
    });
  }

  private async assertNumberIsAvailable(
    phoneNumber: string,
    userId: string,
  ): Promise<void> {
    const existing = await this.prisma.user.findFirst({
      where: {
        phoneNumber,
        NOT: { id: userId },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'That phone number is already verified on another account.',
      );
    }
  }

  private assertCanSend(pending: PendingChallenge, now: Date): void {
    const resendAvailableAt =
      pending.lastSentAt.getTime() + this.getResendCooldownMs();

    if (pending.sendCount >= this.getMaxSends()) {
      throw this.rateLimitException(
        'Too many verification sends. Wait for the current code to expire.',
      );
    }

    if (now.getTime() < resendAvailableAt) {
      const waitSeconds = Math.ceil((resendAvailableAt - now.getTime()) / 1000);
      throw this.rateLimitException(
        `Please wait ${waitSeconds} seconds before requesting another code.`,
      );
    }
  }

  private async sendVerificationSms(
    phoneNumber: string,
    code: string,
    userId: string,
  ): Promise<void> {
    await this.smsSender.sendMessage({
      phoneNumber,
      message: this.buildVerificationMessage(code),
      userId,
    });
  }

  private normalizePhoneNumber(raw: string): string {
    const value = raw.trim();
    if (!value) {
      throw new BadRequestException('Phone number is required');
    }

    let normalized = value.replace(/[^\d+]/g, '');

    if (normalized.startsWith('00')) {
      normalized = `+${normalized.slice(2)}`;
    }

    if (normalized.startsWith('+')) {
      normalized = `+${normalized.slice(1).replace(/\D/g, '')}`;
    } else {
      const digits = normalized.replace(/\D/g, '');
      if (digits.length === 10) {
        normalized = `+1${digits}`;
      } else if (digits.length === 11 && digits.startsWith('1')) {
        normalized = `+${digits}`;
      } else {
        throw new BadRequestException(
          'Enter a valid phone number with country code (for example +15551234567).',
        );
      }
    }

    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      throw new BadRequestException(
        'Enter a valid phone number in E.164 format (for example +15551234567).',
      );
    }

    return normalized;
  }

  private normalizeCode(raw: string): string {
    const code = raw.replace(/\D/g, '');
    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestException('Verification code must be 6 digits.');
    }

    return code;
  }

  private generateCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  private hashCode(code: string): string {
    return createHash('sha256')
      .update(`${this.getVerificationSecret()}:${code}`)
      .digest('hex');
  }

  private hashMatches(code: string, storedHash: string): boolean {
    const candidate = Buffer.from(this.hashCode(code), 'utf8');
    const stored = Buffer.from(storedHash, 'utf8');

    if (candidate.length !== stored.length) {
      return false;
    }

    return timingSafeEqual(candidate, stored);
  }

  private getCodeTtlMs(): number {
    const minutes = Number(
      this.configService.get<string>('PHONE_VERIFICATION_CODE_TTL_MINUTES') ??
        '10',
    );
    return Math.max(1, minutes) * 60_000;
  }

  private getResendCooldownMs(): number {
    const seconds = Number(
      this.configService.get<string>(
        'PHONE_VERIFICATION_RESEND_COOLDOWN_SECONDS',
      ) ?? '30',
    );
    return Math.max(5, seconds) * 1_000;
  }

  private getMaxAttempts(): number {
    return Math.max(
      1,
      Number(
        this.configService.get<string>('PHONE_VERIFICATION_MAX_ATTEMPTS') ??
          '5',
      ),
    );
  }

  private getMaxSends(): number {
    return Math.max(
      1,
      Number(
        this.configService.get<string>('PHONE_VERIFICATION_MAX_SENDS') ?? '3',
      ),
    );
  }

  private maskPhone(phoneNumber: string): string {
    if (phoneNumber.length <= 4) {
      return phoneNumber;
    }

    return `${phoneNumber.slice(0, 3)}***${phoneNumber.slice(-2)}`;
  }

  private rateLimitException(message: string): HttpException {
    return new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
  }

  private getVerificationSecret(): string {
    const secret =
      this.configService.get<string>('PHONE_VERIFICATION_CODE_SECRET') ??
      this.configService.get<string>('JWT_SECRET');

    if (!secret || secret.trim().length === 0) {
      throw new Error(
        'PHONE_VERIFICATION_CODE_SECRET or JWT_SECRET is required for phone verification.',
      );
    }

    return secret.trim();
  }

  private buildVerificationMessage(code: string): string {
    const ttlMinutes = Math.max(1, Math.round(this.getCodeTtlMs() / 60_000));
    return `Your PITCH verification code is ${code}. It expires in ${ttlMinutes} minute${ttlMinutes === 1 ? '' : 's'}.`;
  }
}
