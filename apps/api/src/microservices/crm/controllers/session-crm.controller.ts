import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CRM_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { SessionCrmService } from '../services/session-crm.service';
import { SessionCrmDataPayload } from '../types/salesforce.types';

interface AttachCrmDataPayload extends SessionCrmDataPayload {
  userId: string;
  sessionId: string;
}

interface SessionQueryPayload {
  userId: string;
  sessionId: string;
}

/**
 * Session CRM Controller (CRM Microservice)
 *
 * Handles CRM data attached to AI simulation sessions.
 *
 * Flow:
 * 1. User creates session
 * 2. User sees live CRM data from Salesforce (via salesforce.controller)
 * 3. User selects data to attach to session
 * 4. POST - Attach selected data to session (saves to DB with sessionId)
 * 5. GET - Retrieve attached data from DB
 * 6. REFRESH - Update attached data from Salesforce
 * 7. DELETE - When session deleted, remove attached CRM data
 */
@Controller()
export class SessionCrmController {
  private readonly logger = new Logger(SessionCrmController.name);

  constructor(private readonly sessionCrmService: SessionCrmService) {}

  /**
   * Attach CRM data to session
   * User has selected data from live Salesforce, now save it to DB
   */
  @MessagePattern(CRM_SERVICE_PATTERNS.SESSION_ATTACH_CRM_DATA)
  async attachCrmDataToSession(@Payload() data: AttachCrmDataPayload) {
    try {
      this.logger.log(
        `Attaching CRM data to session ${data.sessionId} for user ${data.userId}`,
      );
      return await this.sessionCrmService.attachCrmDataToSession(
        data.userId,
        data.sessionId,
        data,
      );
    } catch (error) {
      this.logger.error('Failed to attach CRM data to session', error);
      throw error;
    }
  }

  /**
   * Get all CRM data attached to a session
   */
  @MessagePattern(CRM_SERVICE_PATTERNS.SESSION_GET_CRM_DATA)
  async getSessionCrmData(@Payload() data: SessionQueryPayload) {
    try {
      this.logger.log(
        `Getting CRM data for session ${data.sessionId} for user ${data.userId}`,
      );
      return await this.sessionCrmService.getSessionCrmData(
        data.userId,
        data.sessionId,
      );
    } catch (error) {
      this.logger.error('Failed to get session CRM data', error);
      throw error;
    }
  }

  /**
   * Refresh session CRM data from Salesforce
   */
  @MessagePattern(CRM_SERVICE_PATTERNS.SESSION_REFRESH_CRM_DATA)
  async refreshSessionCrmData(@Payload() data: SessionQueryPayload) {
    try {
      this.logger.log(
        `Refreshing CRM data for session ${data.sessionId} for user ${data.userId}`,
      );
      return await this.sessionCrmService.refreshSessionCrmData(
        data.userId,
        data.sessionId,
      );
    } catch (error) {
      this.logger.error('Failed to refresh session CRM data', error);
      throw error;
    }
  }

  /**
   * Delete session CRM data
   * Called when session is deleted
   */
  @MessagePattern(CRM_SERVICE_PATTERNS.SESSION_DELETE_CRM_DATA)
  async deleteSessionCrmData(@Payload() data: SessionQueryPayload) {
    try {
      this.logger.log(
        `Deleting CRM data for session ${data.sessionId} for user ${data.userId}`,
      );
      return await this.sessionCrmService.deleteSessionCrmData(
        data.userId,
        data.sessionId,
      );
    } catch (error) {
      this.logger.error('Failed to delete session CRM data', error);
      throw error;
    }
  }
}
