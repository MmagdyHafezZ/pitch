import { Controller, ValidationPipe, UsePipes, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SessionService } from '../services/session.service';
import { CoinEstimationService } from '../services/coin-estimation.service';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import {
  CreateSessionDto,
  UpdateSessionDto,
  ListSessionsQueryDto,
  EndSessionDto,
  RestartSessionDto,
} from '../dto/session.dto';
import * as userClaimsInterface from '@pitch/shared-backend/interfaces/user-claims.interface';

/**
 * Session Controller (Message-based)
 *
 * Handles RPC message patterns for session operations
 */
@Controller()
export class SessionController {
  private readonly logger = new Logger(SessionController.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly coinEstimation: CoinEstimationService,
  ) {}

  /**
   * Estimate the coin cost for a session before it starts.
   * Called by the gateway `GET /v1/coins/session-estimate`.
   */
  @MessagePattern(SIMULATION_SERVICE_PATTERNS.COIN_SESSION_ESTIMATE)
  async estimateSessionCoins(
    @Payload()
    data: {
      model?: string;
      provider?: string;
      sessionType: string;
      durationMinutes?: number;
    },
  ) {
    try {
      return await this.coinEstimation.estimate({
        model: data.model ?? 'gpt-4o-mini',
        provider: data.provider,
        sessionType: data.sessionType ?? 'text',
        durationMinutes: data.durationMinutes,
      });
    } catch (err) {
      throw toRpcException(err);
    }
  }

  /**
   * Create a new session
   */
  @MessagePattern(SIMULATION_SERVICE_PATTERNS.CREATE_SESSION)
  @UsePipes(new ValidationPipe({ transform: true }))
  async createSession(
    @Payload()
    data: CreateSessionDto & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      if (!data.userClaims?.id) {
        throw new Error('User claims are required to create a session');
      }

      this.logger.log(
        `Creating session - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );

      const { userClaims, ...createSessionDto } = data;

      const sessionData = {
        ...createSessionDto,
        userId: userClaims.id,
        userSnapshot: createSessionDto.userSnapshot || {
          id: userClaims.id,
          email: userClaims.email,
          name: userClaims.name,
        },
      };

      return await this.sessionService.create(sessionData);
    } catch (error) {
      this.logger.error('Failed to create session', error);
      throw toRpcException(error);
    }
  }

  /**
   * Get a session by ID
   */
  @MessagePattern(SIMULATION_SERVICE_PATTERNS.GET_SESSION)
  async getSession(
    @Payload()
    data: { id: string } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Getting session ${data.id} - Requested by: ${data.userClaims?.email || 'unknown'}`,
      );
      return await this.sessionService.findOne(data.id, data.userClaims?.id);
    } catch (error) {
      this.logger.error(`Failed to get session ${data.id}`, error);
      throw toRpcException(error);
    }
  }

  /**
   * List sessions with filters
   */
  @MessagePattern(SIMULATION_SERVICE_PATTERNS.LIST_SESSIONS)
  @UsePipes(new ValidationPipe({ transform: true }))
  async listSessions(
    @Payload()
    data: ListSessionsQueryDto & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Listing sessions - Requested by: ${data.userClaims?.email || 'unknown'}`,
      );
      const { userClaims: _userClaims, ...query } = data;
      return await this.sessionService.findAll(query, _userClaims?.id);
    } catch (error) {
      this.logger.error('Failed to list sessions', error);
      throw toRpcException(error);
    }
  }

  /**
   * Update a session
   */
  @MessagePattern(SIMULATION_SERVICE_PATTERNS.UPDATE_SESSION)
  @UsePipes(
    new ValidationPipe({ transform: true, skipMissingProperties: true }),
  )
  async updateSession(
    @Payload()
    data: { id: string } & UpdateSessionDto &
      userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Updating session ${data.id} - Requested by: ${data.userClaims?.email || 'unknown'}`,
      );
      const { userClaims: _userClaims, id, ...updateData } = data;
      return await this.sessionService.update(id, updateData, _userClaims?.id);
    } catch (error) {
      this.logger.error(`Failed to update session ${data.id}`, error);
      throw toRpcException(error);
    }
  }

  /**
   * End a session
   */
  @MessagePattern(SIMULATION_SERVICE_PATTERNS.END_SESSION)
  @UsePipes(new ValidationPipe({ transform: true }))
  async endSession(
    @Payload()
    data: { id: string } & EndSessionDto &
      userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Ending session ${data.id} - Requested by: ${data.userClaims?.email || 'unknown'}`,
      );
      const { userClaims: _userClaims, id, ...endData } = data;
      return await this.sessionService.end(id, endData, _userClaims?.id);
    } catch (error) {
      this.logger.error(`Failed to end session ${data.id}`, error);
      throw toRpcException(error);
    }
  }

  /**
   * Restart a session with a fresh iteration on the same session record
   */
  @MessagePattern(SIMULATION_SERVICE_PATTERNS.RESTART_SESSION)
  @UsePipes(new ValidationPipe({ transform: true }))
  async restartSession(
    @Payload()
    data: { id: string } & RestartSessionDto &
      userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Restarting session ${data.id} - Requested by: ${data.userClaims?.email || 'unknown'}`,
      );
      const { userClaims: _userClaims, id, ...restartData } = data;
      return await this.sessionService.restart(
        id,
        restartData,
        _userClaims?.id,
      );
    } catch (error) {
      this.logger.error(`Failed to restart session ${data.id}`, error);
      throw toRpcException(error);
    }
  }

  /**
   * Delete a session
   */
  @MessagePattern(SIMULATION_SERVICE_PATTERNS.DELETE_SESSION)
  async deleteSession(
    @Payload()
    data: {
      id: string;
      isAdmin?: boolean;
    } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Deleting session ${data.id} - Requested by: ${data.userClaims?.email || 'unknown'}`,
      );
      return await this.sessionService.remove(
        data.id,
        data.userClaims?.id,
        data.isAdmin === true,
      );
    } catch (error) {
      this.logger.error(`Failed to delete session ${data.id}`, error);
      throw toRpcException(error);
    }
  }
}
