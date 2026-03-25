export interface PhoneCallRequest {
  to: string;
  from?: string;
  webhookUrl?: string;
  statusCallbackUrl?: string;
  metadata?: Record<string, unknown>;
  providerConfig?: Record<string, unknown>;
}

export interface PhoneCallResult {
  provider: string;
  callId: string;
  status?: string;
  to?: string;
  from?: string;
  sessionId?: string;
  raw?: Record<string, unknown>;
}

export interface PhoneCallEndRequest {
  callId: string;
  controlUrl?: string;
}

export interface PhoneProvider {
  readonly name: string;
  readonly description?: string;
  createCall(request: PhoneCallRequest): Promise<PhoneCallResult>;
  endCall?(request: PhoneCallEndRequest): Promise<void>;
}
