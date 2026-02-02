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
import { EmailService } from '../services/email.service';
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
      return await this.emailService.send({
        to: dto.to,
        subject: dto.subject,
        content: dto.content as any,
        from: dto.from as any,
        replyTo: dto.replyTo,
        headers: dto.headers,
      });
    } catch (error) {
      this.logger.error('HTTP sendEmail failed', error as Error);
      throw error;
    }
  }

  private formatTo(to: string | string[]) {
    return Array.isArray(to) ? to.join(',') : to;
  }
}
