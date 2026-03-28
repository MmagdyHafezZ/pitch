export enum SupportEmailTemplate {
  VERIFICATION_CODE = 'verification_code',
  USER_SIGNUP_INVITE = 'user_signup_invite',
  STUDIO_ACCESS_DECISION = 'studio_access_decision',
  PLAN_CHANGE_REQUEST = 'plan_change_request',
  PLAN_CHANGE_DECISION = 'plan_change_decision',
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

export interface SupportStudioAccessDecisionTemplateData {
  recipientName?: string
  decision: 'approved' | 'denied'
  quota?: number
  role?: 'ADMIN' | 'MEMBER'
}

export interface SupportPlanChangeRequestTemplateData {
  /** Name of the user who submitted the request */
  requesterName?: string
  requesterEmail?: string
  currentPlanName?: string
  requestedPlanName: string
  requestedInterval?: string
  /** URL for the admin to review the request */
  reviewUrl?: string
}

export interface SupportPlanChangeDecisionTemplateData {
  recipientName?: string
  decision: 'approved' | 'rejected'
  planName?: string
}

export type SupportEmailTemplateData =
  | SupportVerificationCodeTemplateData
  | SupportUserSignupInviteTemplateData
  | SupportStudioAccessDecisionTemplateData
  | SupportPlanChangeRequestTemplateData
  | SupportPlanChangeDecisionTemplateData

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
