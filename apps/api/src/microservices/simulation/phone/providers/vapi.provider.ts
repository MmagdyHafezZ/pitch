import { HttpException, Injectable } from '@nestjs/common';
import axios from 'axios';
import {
  PhoneCallRequest,
  PhoneCallResult,
  PhoneProvider,
} from './phone.provider';
import { VapiConfigService } from '../vapi-config.service';

@Injectable()
export class VapiPhoneProvider implements PhoneProvider {
  readonly name = 'vapi';
  readonly description = 'Vapi outbound calling';

  constructor(private readonly vapiConfig: VapiConfigService) {}

  async createCall(request: PhoneCallRequest): Promise<PhoneCallResult> {
    const apiKey = this.vapiConfig.getApiKey();

    const providerConfig = request.providerConfig ?? {};
    const phoneNumberId =
      this.resolveString(providerConfig, 'phoneNumberId', 'phone_number_id') ??
      this.vapiConfig.getPhoneNumberId();
    const assistant = this.resolveObject(providerConfig, 'assistant');
    const assistantId = this.resolveHostedAssistantId(providerConfig);

    if (!assistant && !assistantId) {
      throw new Error(
        'Vapi assistant config is required. Hosted assistant fallback is disabled.',
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
    };

    if (assistant) {
      payload.assistant = assistant;
    } else {
      payload.assistantId = assistantId;
    }

    if (typeof providerConfig.customerId === 'string') {
      payload.customerId = providerConfig.customerId;
    }

    if (request.metadata) {
      payload.metadata = request.metadata;
    }

    const callUrl = this.resolveCallUrl();
    let response;
    try {
      response = await axios.post(callUrl, payload, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 20_000,
      });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status ?? 500;
        const message =
          this.formatErrorMessage(error.response.data) ??
          `Vapi request failed with status ${status}`;
        throw new HttpException(message, status);
      }
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

    return {
      provider: this.name,
      callId,
      status,
      to: request.to,
      from: request.from ?? phoneNumberId,
      raw: data,
    };
  }

  private resolveHostedAssistantId(
    providerConfig: Record<string, unknown>,
  ): string | undefined {
    if (!this.vapiConfig.allowHostedAssistantFallback()) {
      return undefined;
    }

    return (
      this.resolveString(providerConfig, 'assistantId', 'assistant_id') ??
      this.vapiConfig.getHostedAssistantId()
    );
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
}
