import { Controller, Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { PhoneCallService } from './phone-call.service';
import { StartPhoneCallDto } from '../dto/phone-call.dto';
import type * as userClaimsInterface from '@pitch/shared-backend/interfaces/user-claims.interface';

@Controller()
export class PhoneCallController {
  private readonly logger = new Logger(PhoneCallController.name);

  constructor(private readonly phoneCallService: PhoneCallService) {}

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.PHONE_CALL_START)
  @UsePipes(new ValidationPipe({ transform: true }))
  async startCall(
    @Payload()
    data: StartPhoneCallDto & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      if (!data.userClaims?.id) {
        throw new Error('User claims are required to start a phone call');
      }

      const { userClaims, ...payload } = data;
      this.logger.log(
        `Starting phone call for session ${payload.sessionId} (requested by ${userClaims.email})`,
      );

      return await this.phoneCallService.startCall({
        ...payload,
        userId: userClaims.id,
      });
    } catch (error) {
      this.logger.error('Failed to start phone call', error);
      throw toRpcException(error);
    }
  }
}
