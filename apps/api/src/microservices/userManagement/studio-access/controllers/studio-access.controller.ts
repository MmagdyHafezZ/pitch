import { Controller, ForbiddenException, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import type { MessageWithUserClaims } from '@pitch/shared-backend/interfaces/user-claims.interface';
import { ReviewStudioAccessRequestDto } from '@pitch/shared-backend/interfaces/user.interface';
import { StudioAccessService } from '../services/studio-access.service';

@Controller()
export class StudioAccessController {
  private readonly logger = new Logger(StudioAccessController.name);

  constructor(private readonly studioAccessService: StudioAccessService) {}

  @MessagePattern(USER_SERVICE_PATTERNS.REQUEST_STUDIO_ACCESS)
  async requestAccess(@Payload() data: MessageWithUserClaims) {
    try {
      this.logger.log(
        `Requesting studio access for ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.studioAccessService.requestAccess(data.userClaims.id);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.LIST_STUDIO_ACCESS_REQUESTS)
  async listRequests(@Payload() data: MessageWithUserClaims) {
    try {
      this.studioAccessService.assertSuperAdmin(data.userClaims.email);
      return await this.studioAccessService.listPendingRequests();
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.APPROVE_STUDIO_ACCESS_REQUEST)
  async approveRequest(
    @Payload()
    data: { userId: string } & ReviewStudioAccessRequestDto &
      MessageWithUserClaims,
  ) {
    try {
      this.studioAccessService.assertSuperAdmin(data.userClaims.email);
      return await this.studioAccessService.approveRequest(
        data.userId,
        { quota: data.quota, role: data.role },
        { id: data.userClaims.id, email: data.userClaims.email },
      );
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw toRpcException(error);
      }
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.DENY_STUDIO_ACCESS_REQUEST)
  async denyRequest(
    @Payload()
    data: { userId: string } & MessageWithUserClaims,
  ) {
    try {
      this.studioAccessService.assertSuperAdmin(data.userClaims.email);
      return await this.studioAccessService.denyRequest(data.userId, {
        id: data.userClaims.id,
        email: data.userClaims.email,
      });
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw toRpcException(error);
      }
      throw toRpcException(error);
    }
  }
}
