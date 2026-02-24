import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  PhoneCallRequest,
  PhoneCallResult,
  PhoneProvider,
} from './phone.provider';

@Injectable()
export class TwilioPhoneProvider implements PhoneProvider {
  readonly name = 'twilio';
  readonly description = 'Twilio Voice';

  constructor(private readonly configService: ConfigService) {}

  async createCall(request: PhoneCallRequest): Promise<PhoneCallResult> {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const defaultFrom = this.configService.get<string>('TWILIO_FROM_NUMBER');

    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials are not configured');
    }

    const from = request.from ?? defaultFrom;
    if (!from) {
      throw new Error('Twilio from number is required');
    }

    if (!request.webhookUrl) {
      throw new Error('Twilio webhook URL is required');
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
    const payload = new URLSearchParams();
    payload.set('To', request.to);
    payload.set('From', from);
    payload.set('Url', request.webhookUrl);
    payload.set('Method', 'POST');

    if (request.statusCallbackUrl) {
      payload.set('StatusCallback', request.statusCallbackUrl);
      payload.set('StatusCallbackMethod', 'POST');
    }

    const response = await axios.post(url, payload.toString(), {
      auth: { username: accountSid, password: authToken },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const data = response.data as {
      sid: string;
      status?: string;
      to?: string;
      from?: string;
    };

    return {
      provider: this.name,
      callId: data.sid,
      status: data.status,
      to: data.to ?? request.to,
      from: data.from ?? from,
      raw: response.data as Record<string, unknown>,
    };
  }
}
