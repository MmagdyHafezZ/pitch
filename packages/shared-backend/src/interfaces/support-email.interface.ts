export enum SupportEmailTemplate {
  VERIFICATION_CODE = 'verification_code',
  USER_SIGNUP_INVITE = 'user_signup_invite',
}

export interface SupportVerificationCodeTemplateData {
  code: string
  purpose?: string
  expiresMinutes?: number
}

export interface SupportUserSignupInviteTemplateData {
  signupUrl?: string
  invitedByName?: string
  teamName?: string
  expiresMinutes?: number
}

export type SupportEmailTemplateData =
  | SupportVerificationCodeTemplateData
  | SupportUserSignupInviteTemplateData

export interface SupportSendTemplatedEmailRequest {
  to: string | string[]
  template: SupportEmailTemplate
  data?: SupportEmailTemplateData
}

export interface SupportSendTemplatedEmailResponse {
  ok: boolean
  provider: 'google' | 'none'
  messageId?: string
  error?: string
}
