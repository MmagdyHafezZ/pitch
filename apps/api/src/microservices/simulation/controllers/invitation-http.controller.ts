import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { InvitationService } from '../services/invitation.service';
import {
  CreateInvitationDto,
  InvitationResponseDto,
  InvitationListResponseDto,
  BulkCreateInvitationsResponseDto,
  DeleteInvitationResponseDto,
  InvitationStatus,
} from '../dto/invitation.dto';
import { HttpErrorResponseDto } from '../dto/http-error.dto';

/**
 * Invitation HTTP Test Controller
 *
 * Provides HTTP endpoints for testing invitation functionality.
 * Base path: /simulation/sessions/:sessionId/invitations and /simulation/invitations
 */
@ApiTags('Simulation Invitations')
@Controller('simulation')
export class InvitationHttpController {
  private readonly logger = new Logger(InvitationHttpController.name);

  constructor(private readonly invitationService: InvitationService) {}

  /**
   * Health check endpoint
   */
  @Get('invitations/health')
  @ApiOperation({ summary: 'Health check for invitation service' })
  @ApiOkResponse({
    schema: {
      example: {
        status: 'ok',
        service: 'simulation-invitations',
        timestamp: '2024-01-23T18:00:00.000Z',
      },
    },
  })
  health() {
    return {
      status: 'ok',
      service: 'simulation-invitations',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create invitations for a session
   */
  @Post('sessions/:sessionId/invitations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite users to a session' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiCreatedResponse({ type: BulkCreateInvitationsResponseDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async createInvitations(
    @Param('sessionId') sessionId: string,
    @Body() createInvitationDto: CreateInvitationDto,
  ): Promise<BulkCreateInvitationsResponseDto> {
    this.logger.log(
      `Creating ${createInvitationDto.inviteeIds.length} invitations for session ${sessionId}`,
    );

    const inviterId = 'test_user_123';

    return await this.invitationService.createInvitations(
      sessionId,
      inviterId,
      createInvitationDto,
    );
  }

  /**
   * List invitations for a session
   */
  @Get('sessions/:sessionId/invitations')
  @ApiOperation({ summary: 'Get all invitations for a session' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiOkResponse({ type: InvitationListResponseDto })
  async listSessionInvitations(
    @Param('sessionId') sessionId: string,
  ): Promise<InvitationListResponseDto> {
    this.logger.log(`Listing invitations for session ${sessionId}`);
    return await this.invitationService.findBySessionId(sessionId);
  }

  /**
   * Get my invitations (received)
   */
  @Get('invitations/me')
  @ApiOperation({ summary: 'Get invitations received by current user' })
  @ApiQuery({ name: 'status', required: false, enum: InvitationStatus })
  @ApiOkResponse({ type: InvitationListResponseDto })
  async getMyInvitations(
    @Query('status') status?: InvitationStatus,
  ): Promise<InvitationListResponseDto> {
    const userId = 'test_user_456';

    this.logger.log(
      `Getting invitations for user ${userId}, status: ${status || 'all'}`,
    );
    return await this.invitationService.findInvitationsForUser(userId, status);
  }

  /**
   * Get invitations I sent
   */
  @Get('invitations/sent')
  @ApiOperation({ summary: 'Get invitations sent by current user' })
  @ApiQuery({ name: 'status', required: false, enum: InvitationStatus })
  @ApiOkResponse({ type: InvitationListResponseDto })
  async getSentInvitations(
    @Query('status') status?: InvitationStatus,
  ): Promise<InvitationListResponseDto> {
    const userId = 'test_user_123';

    this.logger.log(
      `Getting sent invitations for user ${userId}, status: ${status || 'all'}`,
    );
    return await this.invitationService.findInvitationsSentByUser(
      userId,
      status,
    );
  }

  /**
   * Get invitation by ID
   */
  @Get('invitations/:id')
  @ApiOperation({ summary: 'Get invitation by ID' })
  @ApiParam({ name: 'id', description: 'Invitation ID' })
  @ApiOkResponse({ type: InvitationResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async getInvitation(@Param('id') id: string): Promise<InvitationResponseDto> {
    this.logger.log(`Getting invitation ${id}`);
    return await this.invitationService.findOne(id);
  }

  /**
   * Accept an invitation
   */
  @Post('invitations/:id/accept')
  @ApiOperation({ summary: 'Accept an invitation' })
  @ApiParam({ name: 'id', description: 'Invitation ID' })
  @ApiOkResponse({ type: InvitationResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  async acceptInvitation(
    @Param('id') id: string,
  ): Promise<InvitationResponseDto> {
    const userId = 'test_user_456';

    this.logger.log(`User ${userId} accepting invitation ${id}`);
    return await this.invitationService.acceptInvitation(id, userId);
  }

  /**
   * Decline an invitation
   */
  @Post('invitations/:id/decline')
  @ApiOperation({ summary: 'Decline an invitation' })
  @ApiParam({ name: 'id', description: 'Invitation ID' })
  @ApiOkResponse({ type: InvitationResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  async declineInvitation(
    @Param('id') id: string,
  ): Promise<InvitationResponseDto> {
    const userId = 'test_user_456';

    this.logger.log(`User ${userId} declining invitation ${id}`);
    return await this.invitationService.declineInvitation(id, userId);
  }

  /**
   * Revoke an invitation
   */
  @Delete('invitations/:id/revoke')
  @ApiOperation({ summary: 'Revoke an invitation (inviter only)' })
  @ApiParam({ name: 'id', description: 'Invitation ID' })
  @ApiOkResponse({ type: DeleteInvitationResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  async revokeInvitation(
    @Param('id') id: string,
  ): Promise<DeleteInvitationResponseDto> {
    const userId = 'test_user_123';

    this.logger.log(`User ${userId} revoking invitation ${id}`);
    return await this.invitationService.revokeInvitation(id, userId);
  }

  /**
   * Get pending invitation count
   */
  @Get('invitations/pending-count')
  @ApiOperation({
    summary: 'Get count of pending invitations for current user',
  })
  @ApiOkResponse({
    schema: {
      example: { count: 5 },
    },
  })
  async getPendingCount(): Promise<{ count: number }> {
    const userId = 'test_user_456';

    this.logger.log(`Getting pending count for user ${userId}`);
    return await this.invitationService.getPendingCount(userId);
  }
}
