import { HttpException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  PhoneCallEndRequest,
  PhoneCallRequest,
  PhoneCallResult,
  PhoneProvider,
} from './phone.provider';
import { VapiConfigService } from '../vapi-config.service';

@Injectable()
export class VapiPhoneProvider implements PhoneProvider {
  readonly name = 'vapi';
  readonly description = 'Vapi outbound calling';
  private readonly logger = new Logger(VapiPhoneProvider.name);

  constructor(private readonly vapiConfig: VapiConfigService) {}

  async createCall(request: PhoneCallRequest): Promise<PhoneCallResult> {
    const apiKey = this.vapiConfig.getApiKey();

    const providerConfig = request.providerConfig ?? {};
    const phoneNumberId =
      this.resolveString(providerConfig, 'phoneNumberId', 'phone_number_id') ??
      this.vapiConfig.getPhoneNumberId();
    const assistant = this.resolveObject(providerConfig, 'assistant');

    if (!assistant) {
      throw new Error(
        'Vapi assistant config is required for phone calls. Hosted assistant IDs are not supported.',
      );
    }
    const customerConfig = this.resolveObject(providerConfig, 'customer');
    const customer = {
      ...(customerConfig ?? {}),
      number: request.to,
    };

    const payload: Record<string, unknown> = {
      phoneNumberId,
      customer,
      assistant,
    };

    if (typeof providerConfig.customerId === 'string') {
      payload.customerId = providerConfig.customerId;
    }

    if (request.metadata) {
      payload.metadata = request.metadata;
    }

    const callUrl = this.resolveCallUrl();
    let response;
    this.logger.log(
      `vapi.call.request phoneNumberId=${phoneNumberId} to=${this.maskPhone(request.to)} url=${callUrl}`,
    );
    try {
      response = await axios.post(callUrl, payload, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 20_000,
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status ?? 500;
        const rawMessage = error.response
          ? (this.formatErrorMessage(error.response.data) ??
            `Vapi request failed with status ${status}`)
          : error.message;
        const message = this.enrichErrorMessage(rawMessage);

        this.logger.error(
          `vapi.call.failed phoneNumberId=${phoneNumberId} to=${this.maskPhone(request.to)} status=${status} message=${message} response=${this.stringifyForLog(error.response?.data)}`,
        );

        throw new HttpException(message, status);
      }

      this.logger.error(
        `vapi.call.failed phoneNumberId=${phoneNumberId} to=${this.maskPhone(request.to)} unexpected=${this.stringifyForLog(error)}`,
      );
      throw error;
    }

    const data = (response as { data: unknown }).data as Record<
      string,
      unknown
    >;
    const callId =
      (typeof data.id === 'string' && data.id) ||
      (typeof data.callId === 'string' && data.callId) ||
      (typeof data.call === 'object' &&
      data.call &&
      typeof (data.call as Record<string, unknown>).id === 'string'
        ? ((data.call as Record<string, unknown>).id as string)
        : undefined);

    if (!callId) {
      throw new Error('Vapi call did not return a call id');
    }

    const status = typeof data.status === 'string' ? data.status : undefined;

    this.logger.log(
      `vapi.call.started phoneNumberId=${phoneNumberId} to=${this.maskPhone(request.to)} call=${callId} status=${status ?? 'unknown'}`,
    );

    return {
      provider: this.name,
      callId,
      status,
      to: request.to,
      from: request.from ?? phoneNumberId,
      raw: data,
    };
  }

  async endCall(request: PhoneCallEndRequest): Promise<void> {
    if (!request.controlUrl) {
      throw new Error(
        'Vapi live control URL is required to end an active phone call.',
      );
    }

    this.logger.log(
      `vapi.call.end.request call=${request.callId} url=${request.controlUrl}`,
    );

    try {
      await axios.post(
        request.controlUrl,
        { type: 'end-call' },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10_000,
        },
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status ?? 500;
        const rawMessage = error.response
          ? (this.formatErrorMessage(error.response.data) ??
            `Vapi end-call request failed with status ${status}`)
          : error.message;
        const message = this.enrichErrorMessage(rawMessage);

        this.logger.error(
          `vapi.call.end.failed call=${request.callId} status=${status} message=${message} response=${this.stringifyForLog(error.response?.data)}`,
        );

        throw new HttpException(message, status);
      }

      this.logger.error(
        `vapi.call.end.failed call=${request.callId} unexpected=${this.stringifyForLog(error)}`,
      );
      throw error;
    }

    this.logger.log(`vapi.call.end.completed call=${request.callId}`);
  }

  private resolveCallUrl(): string {
    return this.vapiConfig.getCallUrl();
  }

  private formatErrorMessage(payload: unknown): string | undefined {
    if (!payload || typeof payload !== 'object') {
      return undefined;
    }

    const data = payload as Record<string, unknown>;
    if (typeof data.message === 'string') {
      return data.message;
    }

    if (Array.isArray(data.message)) {
      const messages = data.message
        .map((item) => (typeof item === 'string' ? item : ''))
        .filter(Boolean);
      if (messages.length > 0) {
        return messages.join(' ');
      }
    }

    if (typeof data.error === 'string') {
      return data.error;
    }

    return undefined;
  }

  private enrichErrorMessage(message: string): string {
    const normalized = message.toLowerCase();
    if (
      normalized.includes('free vapi numbers') &&
      normalized.includes('international calls')
    ) {
      return `${message} Check that VAPI_PHONE_NUMBER_ID, or a session-level phone.vapi.phoneNumberId override, points to your imported Vapi number instead of a free Vapi number.`;
    }

    return message;
  }

  private resolveString(
    source: Record<string, unknown>,
    ...keys: string[]
  ): string | undefined {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }

    return undefined;
  }

  private resolveObject(
    source: Record<string, unknown>,
    key: string,
  ): Record<string, unknown> | undefined {
    const value = source[key];
    if (value && typeof value === 'object') {
      return value as Record<string, unknown>;
    }

    return undefined;
  }

  private maskPhone(phoneNumber: string): string {
    return phoneNumber.length > 4
      ? `${phoneNumber.slice(0, 3)}***${phoneNumber.slice(-2)}`
      : phoneNumber;
  }

  private stringifyForLog(value: unknown): string {
    if (value == null) {
      return 'null';
    }

    if (typeof value === 'string') {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return '[unserializable]';
    }
  }
}
