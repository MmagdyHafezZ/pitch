import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { SUPPORT_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import {
  SupportEmailTemplate,
  type SupportSendTemplatedEmailRequest,
  type SupportSendTemplatedEmailResponse,
  type SupportStudioAccessDecisionTemplateData,
} from '@pitch/shared-backend/interfaces/support-email.interface';

export interface StudioAccessDecisionEmailInput
  extends SupportStudioAccessDecisionTemplateData {
  email: string;
}

@Injectable()
export class StudioAccessEmailService {
  private readonly logger = new Logger(StudioAccessEmailService.name);

  constructor(
    @Inject('SUPPORT_SERVICE')
    private readonly supportServiceClient: ClientProxy,
  ) {}

  async sendDecisionEmail(
    input: StudioAccessDecisionEmailInput,
  ): Promise<void> {
    const request: SupportSendTemplatedEmailRequest = {
      to: input.email,
      template: SupportEmailTemplate.STUDIO_ACCESS_DECISION,
      data: {
        recipientName: input.recipientName,
        decision: input.decision,
        quota: input.quota,
        role: input.role,
      },
    };

    let response: SupportSendTemplatedEmailResponse;

    try {
      response = await firstValueFrom(
        this.supportServiceClient
          .send<
            SupportSendTemplatedEmailResponse,
            SupportSendTemplatedEmailRequest
          >(SUPPORT_SERVICE_PATTERNS.EMAIL_SEND_TEMPLATE, request)
          .pipe(timeout(5000)),
      );
    } catch (error) {
      this.logger.error(
        `Failed to dispatch studio access ${input.decision} email to ${input.email}`,
        error as Error,
      );
      throw new InternalServerErrorException(
        'Failed to send studio access decision email',
      );
    }

    if (!response.ok) {
      this.logger.error(
        `Support email service rejected studio access ${input.decision} email for ${input.email}: ${response.error ?? 'Unknown error'}`,
      );
      throw new InternalServerErrorException(
        response.error || 'Failed to send studio access decision email',
      );
    }
  }
}
