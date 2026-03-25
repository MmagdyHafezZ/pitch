import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Inject,
  HttpException,
  HttpStatus,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { catchError, timeout } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { GlobalJwtAuthGuard } from '../../guards/global-jwt-auth.guard';
import { Public } from '../../../microservices/userManagement/decorators/public.decorator';
import { UserClaimsInterceptor } from '../../interceptors/user-claims.interceptor';
import { UserClaims } from '../../decorators/user-claims.decorator';
import type { UserClaims as UserClaimsType } from '@pitch/shared-backend/interfaces/user-claims.interface';
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';

/**
 * Invitation Gateway Controller
 *
 * HTTP Gateway controller that forwards invitation requests
 * to the simulation microservice via RabbitMQ.
 *
 * Base path: /v1/simulation
 */
@ApiTags('simulation-invitations')
@Controller({ path: 'simulation', version: '1' })
@UseGuards(GlobalJwtAuthGuard)
@UseInterceptors(UserClaimsInterceptor)
@ApiBearerAuth('bearer')
export class InvitationGatewayController {
  constructor(
    @Inject('SIMULATION_SERVICE') private simulationService: ClientProxy,
  ) {}

  /**
   * Create invitations for a session
   */
  @Post('sessions/:sessionId/invitations')
  @ApiOperation({ summary: 'Invite users to a session' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({ status: 201, description: 'Invitations created successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or permission denied',
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  createInvitations(
    @Param('sessionId') sessionId: string,
    @Body() createInvitationDto: any,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.CREATE_INVITATIONS, {
        sessionId,
        inviterId: userClaims.id,
        ...createInvitationDto,
        userClaims,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to create invitations';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * List invitations for a session
   */
  @Get('sessions/:sessionId/invitations')
  @ApiOperation({ summary: 'Get all invitations for a session' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({
    status: 200,
    description: 'Invitations retrieved successfully',
  })
  listSessionInvitations(
    @Param('sessionId') sessionId: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.LIST_SESSION_INVITATIONS, {
        sessionId,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to list invitations';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * Get my invitations (received)
   */
  @Get('invitations/me')
  @ApiOperation({ summary: 'Get invitations received by current user' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'accepted', 'declined'],
  })
  @ApiResponse({
    status: 200,
    description: 'Invitations retrieved successfully',
  })
  getMyInvitations(
    @Query('status') status: string | undefined,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.LIST_USER_INVITATIONS, {
        userId: userClaims.id,
        status,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to get invitations';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * Get invitations I sent
   */
  @Get('invitations/sent')
  @ApiOperation({ summary: 'Get invitations sent by current user' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'accepted', 'declined'],
  })
  @ApiResponse({
    status: 200,
    description: 'Invitations retrieved successfully',
  })
  getSentInvitations(
    @Query('status') status: string | undefined,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.LIST_SENT_INVITATIONS, {
        userId: userClaims.id,
        status,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to get sent invitations';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * Liveness probe — no auth required
   */
  @Get('invitations/health')
  @Public()
  @ApiOperation({ summary: 'Health check for simulation invitations service' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  health() {
    return {
      status: 'ok',
      service: 'simulation-invitations',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get invitation by ID
   */
  @Get('invitations/:id')
  @ApiOperation({ summary: 'Get invitation by ID' })
  @ApiParam({ name: 'id', description: 'Invitation ID' })
  @ApiResponse({
    status: 200,
    description: 'Invitation retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  getInvitation(
    @Param('id') id: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.GET_INVITATION, {
        id,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to get invitation';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * Accept an invitation
   */
  @Post('invitations/:id/accept')
  @ApiOperation({ summary: 'Accept an invitation' })
  @ApiParam({ name: 'id', description: 'Invitation ID' })
  @ApiResponse({ status: 200, description: 'Invitation accepted successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid action or already responded',
  })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  acceptInvitation(
    @Param('id') id: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.ACCEPT_INVITATION, {
        id,
        userId: userClaims.id,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to accept invitation';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * Decline an invitation
   */
  @Post('invitations/:id/decline')
  @ApiOperation({ summary: 'Decline an invitation' })
  @ApiParam({ name: 'id', description: 'Invitation ID' })
  @ApiResponse({ status: 200, description: 'Invitation declined successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid action or already responded',
  })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  declineInvitation(
    @Param('id') id: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.DECLINE_INVITATION, {
        id,
        userId: userClaims.id,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to decline invitation';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * Revoke an invitation
   */
  @Delete('invitations/:id/revoke')
  @ApiOperation({ summary: 'Revoke an invitation (inviter only)' })
  @ApiParam({ name: 'id', description: 'Invitation ID' })
  @ApiResponse({ status: 200, description: 'Invitation revoked successfully' })
  @ApiResponse({
    status: 400,
    description: 'Permission denied or invalid action',
  })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  revokeInvitation(
    @Param('id') id: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.REVOKE_INVITATION, {
        id,
        userId: userClaims.id,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to revoke invitation';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  /**
   * Get pending invitation count
   */
  @Get('invitations/pending-count')
  @ApiOperation({
    summary: 'Get count of pending invitations for current user',
  })
  @ApiResponse({ status: 200, description: 'Count retrieved successfully' })
  getPendingCount(@UserClaims() userClaims: UserClaimsType) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.GET_PENDING_COUNT, {
        userId: userClaims.id,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to get pending count';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }
}
