import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Logger,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
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
} from '@nestjs/swagger';
import { SessionService } from '../services/session.service';
import {
  CreateSessionDto,
  UpdateSessionDto,
  EndSessionDto,
  ListSessionsQueryDto,
  SessionResponseDto,
  SessionListResponseDto,
  DeleteSessionResponseDto,
} from '../dto/session.dto';
import { HttpErrorResponseDto } from '../dto/http-error.dto';

/**
 * Session HTTP Test Controller
 *
 * Provides HTTP endpoints for testing session management functionality.
 * This is separate from the production RabbitMQ-based session controller.
 *
 * Base path: /simulation/sessions
 */
@ApiTags('Simulation Sessions')
@Controller('simulation/sessions')
export class SessionHttpController {
  private readonly logger = new Logger(SessionHttpController.name);

  constructor(private readonly sessionService: SessionService) {}

  /**
   * Health check endpoint
   *
   * GET /simulation/sessions/health
   */
  @Get('health')
  @ApiOperation({ summary: 'Health check for session service' })
  @ApiOkResponse({
    schema: {
      example: {
        status: 'ok',
        service: 'simulation-sessions',
        timestamp: '2024-01-01T12:00:00.000Z',
      },
    },
  })
  health() {
    return {
      status: 'ok',
      service: 'simulation-sessions',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create a new session
   *
   * POST /simulation/sessions
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new session' })
  @ApiCreatedResponse({ type: SessionResponseDto })
  @ApiBadRequestResponse({
    type: HttpErrorResponseDto,
    description: 'Invalid request data.',
  })
  @ApiInternalServerErrorResponse({
    type: HttpErrorResponseDto,
    description: 'Unexpected error.',
  })
  async createSession(
    @Body() createSessionDto: CreateSessionDto,
  ): Promise<SessionResponseDto> {
    this.logger.log(`Creating session for org: ${createSessionDto.orgId}`);

    try {
      const TEST_USER_ID = 'test-user-http-endpoint';
      const session = await this.sessionService.create(
        createSessionDto,
        TEST_USER_ID,
      );
      this.logger.log(`Created session: ${session.id}`);
      return session;
    } catch (error) {
      this.logger.error('Failed to create session', error);
      throw error;
    }
  }

  /**
   * List sessions with optional filters
   *
   * GET /simulation/sessions
   */
  @Get()
  @ApiOperation({ summary: 'List sessions with optional filters' })
  @ApiOkResponse({ type: SessionListResponseDto })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'orgId', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, enum: ['text', 'voice', 'video'] })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'scenarioId', required: false, type: String })
  @ApiQuery({ name: 'personaId', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiInternalServerErrorResponse({
    type: HttpErrorResponseDto,
    description: 'Unexpected error.',
  })
  async listSessions(
    @Query() query: ListSessionsQueryDto,
  ): Promise<SessionListResponseDto> {
    this.logger.log(`Listing sessions with filters: ${JSON.stringify(query)}`);

    try {
      const result = await this.sessionService.findAll(query);
      this.logger.log(
        `Found ${result.sessions.length} sessions out of ${result.total} total`,
      );
      return result;
    } catch (error) {
      this.logger.error('Failed to list sessions', error);
      throw error;
    }
  }

  /**
   * Get a single session by ID
   *
   * GET /simulation/sessions/:id
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a session by ID' })
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiNotFoundResponse({
    type: HttpErrorResponseDto,
    description: 'Session not found.',
  })
  @ApiInternalServerErrorResponse({
    type: HttpErrorResponseDto,
    description: 'Unexpected error.',
  })
  async getSession(@Param('id') id: string): Promise<SessionResponseDto> {
    this.logger.log(`Getting session: ${id}`);

    try {
      const session = await this.sessionService.findOne(id);
      this.logger.log(`Found session: ${session.id}`);
      return session;
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.warn(`Session not found: ${id}`);
      } else {
        this.logger.error(`Failed to get session: ${id}`, error);
      }
      throw error;
    }
  }

  /**
   * Update a session
   *
   * PUT /simulation/sessions/:id
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update a session' })
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiNotFoundResponse({
    type: HttpErrorResponseDto,
    description: 'Session not found.',
  })
  @ApiBadRequestResponse({
    type: HttpErrorResponseDto,
    description: 'Invalid request data or session already ended.',
  })
  @ApiInternalServerErrorResponse({
    type: HttpErrorResponseDto,
    description: 'Unexpected error.',
  })
  async updateSession(
    @Param('id') id: string,
    @Body() updateSessionDto: UpdateSessionDto,
  ): Promise<SessionResponseDto> {
    this.logger.log(`Updating session: ${id}`);

    try {
      const session = await this.sessionService.update(id, updateSessionDto);
      this.logger.log(`Updated session: ${session.id}`);
      return session;
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.warn(`Session not found: ${id}`);
      } else if (error instanceof BadRequestException) {
        this.logger.warn(`Cannot update session: ${id} - ${error.message}`);
      } else {
        this.logger.error(`Failed to update session: ${id}`, error);
      }
      throw error;
    }
  }

  /**
   * End a session
   *
   * POST /simulation/sessions/:id/end
   */
  @Post(':id/end')
  @ApiOperation({ summary: 'End a session' })
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiNotFoundResponse({
    type: HttpErrorResponseDto,
    description: 'Session not found.',
  })
  @ApiBadRequestResponse({
    type: HttpErrorResponseDto,
    description: 'Session already ended.',
  })
  @ApiInternalServerErrorResponse({
    type: HttpErrorResponseDto,
    description: 'Unexpected error.',
  })
  async endSession(
    @Param('id') id: string,
    @Body() endSessionDto: EndSessionDto,
  ): Promise<SessionResponseDto> {
    this.logger.log(
      `Ending session: ${id} with reason: ${endSessionDto.reason}`,
    );

    try {
      const session = await this.sessionService.end(id, endSessionDto);
      this.logger.log(`Ended session: ${session.id}`);
      return session;
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.warn(`Session not found: ${id}`);
      } else if (error instanceof BadRequestException) {
        this.logger.warn(`Cannot end session: ${id} - ${error.message}`);
      } else {
        this.logger.error(`Failed to end session: ${id}`, error);
      }
      throw error;
    }
  }

  /**
   * Delete a session
   *
   * DELETE /simulation/sessions/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a session' })
  @ApiOkResponse({ type: DeleteSessionResponseDto })
  @ApiNotFoundResponse({
    type: HttpErrorResponseDto,
    description: 'Session not found.',
  })
  @ApiInternalServerErrorResponse({
    type: HttpErrorResponseDto,
    description: 'Unexpected error.',
  })
  async deleteSession(
    @Param('id') id: string,
  ): Promise<DeleteSessionResponseDto> {
    this.logger.log(`Deleting session: ${id}`);

    try {
      const result = await this.sessionService.remove(id);
      this.logger.log(`Deleted session: ${id}`);
      return result;
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.warn(`Session not found: ${id}`);
      } else {
        this.logger.error(`Failed to delete session: ${id}`, error);
      }
      throw error;
    }
  }

  /**
   * Get active sessions for a user
   *
   * GET /simulation/sessions/user/:userId/active
   */
  @Get('user/:userId/active')
  @ApiOperation({ summary: 'Get active sessions for a user' })
  @ApiOkResponse({ type: [SessionResponseDto] })
  @ApiInternalServerErrorResponse({
    type: HttpErrorResponseDto,
    description: 'Unexpected error.',
  })
  async getActiveUserSessions(
    @Param('userId') userId: string,
  ): Promise<SessionResponseDto[]> {
    this.logger.log(`Getting active sessions for user: ${userId}`);

    try {
      const sessions = await this.sessionService.findActiveByUserId(userId);
      this.logger.log(
        `Found ${sessions.length} active sessions for user: ${userId}`,
      );
      return sessions;
    } catch (error) {
      this.logger.error(
        `Failed to get active sessions for user: ${userId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get active sessions for an organization
   *
   * GET /simulation/sessions/org/:orgId/active
   */
  @Get('org/:orgId/active')
  @ApiOperation({ summary: 'Get active sessions for an organization' })
  @ApiOkResponse({ type: [SessionResponseDto] })
  @ApiInternalServerErrorResponse({
    type: HttpErrorResponseDto,
    description: 'Unexpected error.',
  })
  async getActiveOrgSessions(
    @Param('orgId') orgId: string,
  ): Promise<SessionResponseDto[]> {
    this.logger.log(`Getting active sessions for organization: ${orgId}`);

    try {
      const sessions = await this.sessionService.findActiveByOrgId(orgId);
      this.logger.log(
        `Found ${sessions.length} active sessions for organization: ${orgId}`,
      );
      return sessions;
    } catch (error) {
      this.logger.error(
        `Failed to get active sessions for organization: ${orgId}`,
        error,
      );
      throw error;
    }
  }
}
