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
} from '@pitch/shared-backend/interfaces/support-email.interface';

export interface TeamSignupInviteEmailInput {
  email: string;
  signupUrl?: string;
  invitedByName?: string;
  teamName?: string;
}

@Injectable()
export class TeamInviteEmailService {
  private readonly logger = new Logger(TeamInviteEmailService.name);

  constructor(
    @Inject('SUPPORT_SERVICE')
    private readonly supportServiceClient: ClientProxy,
  ) {}

  async sendSignupInvite(input: TeamSignupInviteEmailInput): Promise<void> {
    const request: SupportSendTemplatedEmailRequest = {
      to: input.email,
      template: SupportEmailTemplate.USER_SIGNUP_INVITE,
      data: {
        signupUrl: input.signupUrl,
        invitedByName: input.invitedByName,
        teamName: input.teamName,
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
        `Failed to dispatch signup invite email to ${input.email}`,
        error as Error,
      );
      throw new InternalServerErrorException(
        'Failed to send signup invite email',
      );
    }

    if (!response.ok) {
      this.logger.error(
        `Support email service rejected signup invite for ${input.email}: ${response.error ?? 'Unknown error'}`,
      );
      throw new InternalServerErrorException(
        response.error || 'Failed to send signup invite email',
      );
    }
  }
}
