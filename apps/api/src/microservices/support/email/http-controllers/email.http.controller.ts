// apps/support/src/controllers/http/email.http.controller.ts
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  EmailService,
  type EmailContent,
  type EmailFrom,
  type SendEmailRequest,
} from '../services/email.service';
import {
  HtmlContentDto,
  SendEmailDto,
  SendVerificationCodeDto,
  TextContentDto,
} from '../dto/email.dto';
import { ApiTags, ApiExtraModels } from '@nestjs/swagger';

/**
 * Email HTTP Controller (Support MS)
 * Focus: verification-code auth emails (and optional generic send if you want it)
 */
@ApiTags('Email')
@ApiExtraModels(TextContentDto, HtmlContentDto)
@Controller('email')
export class EmailHttpController {
  private readonly logger = new Logger(EmailHttpController.name);

  constructor(private readonly emailService: EmailService) {}

  /**
   * POST /email/verification-code
   * Sends a verification code email (used for auth).
   */
  @Post('verification-code')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async sendVerificationCode(@Body() dto: SendVerificationCodeDto) {
    try {
      this.logger.log(
        `HTTP sendVerificationCode to=${dto.email} purpose=${dto.purpose ?? 'login'}`,
      );
      return await this.emailService.sendVerificationCode(dto.email, dto.code);
    } catch (error) {
      this.logger.error('HTTP sendVerificationCode failed', error as Error);
      throw error;
    }
  }

  /**
   * POST /email/send
   * Optional: keep this if you want a generic send endpoint too.
   */
  @Post('send')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async send(@Body() dto: SendEmailDto) {
    try {
      this.logger.log(
        `HTTP sendEmail to=${this.formatTo(dto.to)} subject="${dto.subject}"`,
      );
      const content: EmailContent =
        dto.content.kind === 'text'
          ? { kind: 'text', text: dto.content.text }
          : {
              kind: 'html',
              html: dto.content.html,
              textFallback: dto.content.textFallback,
            };
      const from: EmailFrom | undefined = dto.from
        ? { name: dto.from.name, address: dto.from.address }
        : undefined;
      const request: SendEmailRequest = {
        to: dto.to,
        subject: dto.subject,
        content,
        from,
        replyTo: dto.replyTo,
        headers: dto.headers,
      };
      return await this.emailService.send(request);
    } catch (error) {
      this.logger.error('HTTP sendEmail failed', error as Error);
      throw error;
    }
  }

  private formatTo(to: string | string[]) {
    return Array.isArray(to) ? to.join(',') : to;
  }
}
