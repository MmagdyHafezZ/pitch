// apps/support/src/controllers/rpc/email.rpc.controller.ts
import { Controller, Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import { SUPPORT_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { EmailService } from '../services/email.service';
import {
  SendTemplatedEmailDto,
  SendVerificationCodeDto,
} from '../dto/email.dto';

/**
 * Email RPC Controller (Support MS)
 * Focus: verification code email for auth flows
 */
@Controller()
export class EmailRpcController {
  private readonly logger = new Logger(EmailRpcController.name);

  constructor(private readonly emailService: EmailService) {}

  /**
   * Pattern: support.email.sendVerificationCode
   */
  @MessagePattern(SUPPORT_SERVICE_PATTERNS.EMAIL_SEND_VERIFICATION_CODE)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async sendVerificationCode(@Payload() dto: SendVerificationCodeDto) {
    try {
      this.logger.log(
        `RPC EMAIL_SEND_VERIFICATION_CODE to=${dto.email} purpose=${dto.purpose ?? 'login'}`,
      );
      return await this.emailService.sendVerificationCode(
        dto.email,
        dto.code,
        dto.purpose,
      );
    } catch (error) {
      this.logger.error(
        'RPC EMAIL_SEND_VERIFICATION_CODE failed',
        error as Error,
      );
      throw toRpcException(error);
    }
  }

  @MessagePattern(SUPPORT_SERVICE_PATTERNS.EMAIL_SEND_TEMPLATE)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async sendTemplate(@Payload() dto: SendTemplatedEmailDto) {
    try {
      this.logger.log(
        `RPC EMAIL_SEND_TEMPLATE to=${dto.to} template=${dto.template}`,
      );
      return await this.emailService.sendTemplate(
        dto.to,
        dto.template,
        dto.data,
      );
    } catch (error) {
      this.logger.error('RPC EMAIL_SEND_TEMPLATE failed', error as Error);
      throw toRpcException(error);
    }
  }
}
