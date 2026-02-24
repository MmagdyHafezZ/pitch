import { AssessmentMode } from '@prisma/simulation-client';
export interface AssessmentRunRequestMessage {
  runId: string;
  iterationId?: string;
  sessionId?: string;
  sessionMemberId?: string;
  mode: AssessmentMode;
  requestedBy?: string;
  configVersion?: string;
}

export interface AssessmentRunCompletedEvent {
  runId: string;
  iterationId?: string;
  sessionId?: string;
  sessionMemberId?: string;
  totalScore: number;
  createdAt: string;
}

export interface AssessmentRunFailedEvent {
  runId: string;
  error: string;
}
