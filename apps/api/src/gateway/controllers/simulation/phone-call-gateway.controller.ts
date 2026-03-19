import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { lastValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import {
  SIMULATION_SERVICE_PATTERNS,
  USER_SERVICE_PATTERNS,
} from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { GlobalJwtAuthGuard } from '../../guards/global-jwt-auth.guard';
import { UserClaimsInterceptor } from '../../interceptors/user-claims.interceptor';
import { UserClaims } from '../../decorators/user-claims.decorator';
import type { UserClaims as UserClaimsType } from '@pitch/shared-backend/interfaces/user-claims.interface';
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';
import type { PhoneVerificationStatus } from '@pitch/shared-backend/interfaces/user.interface';

@ApiTags('simulation-phone-calls')
@Controller({ path: 'simulation/phone-calls', version: '1' })
@UseGuards(GlobalJwtAuthGuard)
@UseInterceptors(UserClaimsInterceptor)
@ApiBearerAuth('bearer')
export class PhoneCallGatewayController {
  constructor(
    @Inject('SIMULATION_SERVICE')
    private readonly simulationService: ClientProxy,
    @Inject('USER_SERVICE') private readonly userService: ClientProxy,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Start a phone call for a session' })
  @ApiResponse({ status: 201, description: 'Call initiated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Phone number must be verified before starting a call',
  })
  async startCall(
    @Body()
    payload: { sessionId: string; firstMessage?: string; phoneNumber?: string },
    @UserClaims() userClaims: UserClaimsType,
  ) {
    try {
      const verification = await lastValueFrom(
        this.userService
          .send<PhoneVerificationStatus>(
            USER_SERVICE_PATTERNS.GET_MY_PHONE_VERIFICATION,
            { userClaims },
          )
          .pipe(timeout(5000)),
      );

      const storedVerifiedPhone =
        verification.verified && verification.phoneNumber
          ? verification.phoneNumber
          : null;
      const temporaryVerifiedPhone =
        verification.temporaryVerifiedPhoneNumber ?? null;
      const requestedPhone = payload.phoneNumber?.trim() || null;
      const allowedPhoneNumbers = new Set(
        [storedVerifiedPhone, temporaryVerifiedPhone].filter(
          (value): value is string => Boolean(value),
        ),
      );
      const resolvedPhoneNumber =
        requestedPhone ?? storedVerifiedPhone ?? temporaryVerifiedPhone;

      if (
        !resolvedPhoneNumber ||
        !allowedPhoneNumbers.has(resolvedPhoneNumber)
      ) {
        throw new HttpException(
          'Verify your phone number before starting a phone call.',
          HttpStatus.FORBIDDEN,
        );
      }

      return await lastValueFrom(
        this.simulationService
          .send(SIMULATION_SERVICE_PATTERNS.PHONE_CALL_START, {
            sessionId: payload.sessionId,
            ...(payload.firstMessage
              ? { firstMessage: payload.firstMessage }
              : {}),
            phoneNumber: resolvedPhoneNumber,
            userClaims,
          })
          .pipe(timeout(10000)),
      );
    } catch (err: unknown) {
      const error = normalizeError(err);
      const message = error.message ?? 'Failed to start phone call';
      const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(message, status);
    }
  }
}
