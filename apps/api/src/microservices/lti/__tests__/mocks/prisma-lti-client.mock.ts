/**
 * Manual mock for @prisma/lti-client
 * Used in tests since the Prisma client is generated at runtime.
 */

export enum LtiVersion {
  V1P1 = 'V1P1',
  V1P3 = 'V1P3',
}

export enum LtiRole {
  INSTRUCTOR = 'INSTRUCTOR',
  LEARNER = 'LEARNER',
  TEACHING_ASSISTANT = 'TEACHING_ASSISTANT',
  ADMINISTRATOR = 'ADMINISTRATOR',
  CONTENT_DEVELOPER = 'CONTENT_DEVELOPER',
  MENTOR = 'MENTOR',
  OBSERVER = 'OBSERVER',
  GRADER = 'GRADER',
  UNKNOWN = 'UNKNOWN',
}

export enum ContentItemType {
  LINK = 'LINK',
  LTI_RESOURCE_LINK = 'LTI_RESOURCE_LINK',
  FILE = 'FILE',
  HTML = 'HTML',
  IMAGE = 'IMAGE',
}

export enum ActivityProgress {
  INITIALIZED = 'INITIALIZED',
  STARTED = 'STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  COMPLETED = 'COMPLETED',
}

export enum GradingProgress {
  NOT_READY = 'NOT_READY',
  FAILED = 'FAILED',
  PENDING = 'PENDING',
  PENDING_MANUAL = 'PENDING_MANUAL',
  FULLY_GRADED = 'FULLY_GRADED',
}

export class PrismaClient {
  ltiPlatform = {};
  ltiDeployment = {};
  ltiNonce = {};
  ltiSession = {};
  ltiLineItem = {};
  ltiScore = {};
  $connect = jest.fn();
  $disconnect = jest.fn();
}
