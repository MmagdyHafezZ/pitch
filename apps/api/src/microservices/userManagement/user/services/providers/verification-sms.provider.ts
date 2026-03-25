export interface SmsMessageRequest {
  phoneNumber: string;
  message: string;
  userId: string;
}

export interface VerificationSmsSender {
  assertConfigured(): void;
  sendMessage(input: SmsMessageRequest): Promise<void>;
}

export const VERIFICATION_SMS_SENDER = Symbol('VERIFICATION_SMS_SENDER');
