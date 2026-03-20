import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../../microservices/userManagement/decorators/public.decorator';
import { PhoneCallWebhookService } from './phone-call-webhook.service';

@ApiTags('simulation-phone-calls')
@Controller({ path: 'simulation/phone-calls', version: '1' })
export class PhoneCallWebhookController {
  constructor(
    private readonly phoneCallWebhookService: PhoneCallWebhookService,
  ) {}

  @Post('twilio')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Twilio voice webhook' })
  async handleTwilioWebhook(
    @Body() body: Record<string, string>,
    @Query() query: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.phoneCallWebhookService.processTwilioWebhook(
      body,
      query,
      {
        request: {
          protocol: req.protocol,
          forwardedProto: req.headers['x-forwarded-proto'],
          forwardedHost: req.headers['x-forwarded-host'],
          host: req.get('host') ?? undefined,
          hostname: req.hostname,
          originalUrl: req.originalUrl,
        },
      },
    );
    res.type('text/xml').send(result.twiml);
  }
}
