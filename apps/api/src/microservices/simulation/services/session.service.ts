import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { SessionRepository } from '../repositories/session.repository';
import type { SessionMember } from '@prisma/simulation-client';
import type { PrismaError } from '@pitch/shared-backend/interfaces/error.interface';
import {
  CreateSessionDto,
  UpdateSessionDto,
  ListSessionsQueryDto,
  SessionResponseDto,
  SessionListResponseDto,
  DeleteSessionResponseDto,
  EndSessionDto,
  SessionType,
} from '../dto/session.dto';
import { SessionMemberRepository } from '../repositories/session-member.repository';
import type { SessionWithOwner } from '../repositories/session.repository';

/**
 * Session Service
 *
 * Handles business logic for session management
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly sessionMemberRepository: SessionMemberRepository,
  ) {}

  /**
   * Find all sessions with optional filters and pagination
   */
  async findAll(
    query: ListSessionsQueryDto,
    requesterUserId?: string,
  ): Promise<SessionListResponseDto> {
    this.logger.log(`Finding sessions with filters: ${JSON.stringify(query)}`);

    const effectiveUserId = query.userId || requesterUserId;
    const filters = {
      userId: effectiveUserId,
      orgId: query.orgId,
      type: query.type,
      status: query.status,
      scenarioId: query.scenarioId,
      personaId: query.personaId,
    };

    const limit = query.limit ? Number(query.limit) : 10;
    const offset = query.offset ? Number(query.offset) : 0;

    const { sessions, total } = await this.sessionRepository.findMany(
      filters,
      limit,
      offset,
    );

    this.logger.log(`Found ${sessions.length} sessions out of ${total} total`);

    return {
      sessions: sessions.map(this.mapToResponseDto),
      total,
      limit,
      offset,
    };
  }

  /**
   * Find a single session by ID
   */
  async findOne(
    id: string,
    requesterUserId?: string,
  ): Promise<SessionResponseDto> {
    this.logger.log(`Finding session with ID: ${id}`);

    if (id === undefined || id === null) {
      throw new BadRequestException('Session ID is required');
    }

    if (requesterUserId) {
      const member =
        await this.sessionMemberRepository.findBySessionIdAndUserId(
          id,
          requesterUserId,
        );
      if (!member) {
        throw new ForbiddenException(
          `User ${requesterUserId} does not have access to session ${id}`,
        );
      }
    }

    const session = await this.sessionRepository.findById(id);
    if (!session) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    this.logger.log(`Found session: ${session.id}`);
    return this.mapToResponseDto(session);
  }

  /**
   * Find sessions by user ID
   */
  async findByUserId(
    userId: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<SessionListResponseDto> {
    this.logger.log(`Finding sessions for user: ${userId}`);

    const numLimit = Number(limit) || 10;
    const numOffset = Number(offset) || 0;

    const { sessions, total } = await this.sessionRepository.findByUserId(
      userId,
      numLimit,
      numOffset,
    );

    return {
      sessions: sessions.map(this.mapToResponseDto),
      total,
      limit: numLimit,
      offset: numOffset,
    };
  }

  /**
   * Find sessions by organization ID
   */
  async findByOrgId(
    orgId: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<SessionListResponseDto> {
    this.logger.log(`Finding sessions for organization: ${orgId}`);

    const numLimit = Number(limit) || 10;
    const numOffset = Number(offset) || 0;

    const { sessions, total } = await this.sessionRepository.findByOrgId(
      orgId,
      numLimit,
      numOffset,
    );

    return {
      sessions: sessions.map(this.mapToResponseDto),
      total,
      limit: numLimit,
      offset: numOffset,
    };
  }

  /**
   * Create a new session
   * Note: userId should be provided (either in DTO for testing or via parameter from JWT)
   */
  async create(
    createSessionDto:
      | CreateSessionDto
      | (CreateSessionDto & { userId: string }),
    userId?: string,
  ): Promise<SessionResponseDto> {
    const sessionUserId =
      'userId' in createSessionDto ? createSessionDto.userId : userId;

    if (!sessionUserId) {
      throw new BadRequestException('userId is required to create a session');
    }

    this.logger.log(`Creating new session for user: ${sessionUserId}`);

    try {
      const session = await this.sessionRepository.create({
        ownerUserId: sessionUserId,
        orgId: createSessionDto.orgId,
        ownerSnapshot: createSessionDto.userSnapshot,
        orgSnapshot: createSessionDto.orgSnapshot,
        name: createSessionDto.name,
        type: createSessionDto.type,
        tags: createSessionDto.tags,
        sessionConfig: createSessionDto.sessionConfig,
        scenarioId: createSessionDto.scenarioId,
        personaId: createSessionDto.personaId,
        language: createSessionDto.language,
        crmContextId: createSessionDto.crmContextId,
      });

      this.logger.log(`Created session: ${session.id}`);
      return this.mapToResponseDto(session);
    } catch (error) {
      const err = error as { code?: string; meta?: { constraint?: string } };

      if (err.code === 'P2003') {
        const meta = err.meta;
        if (meta?.constraint === 'Session_scenarioId_fkey') {
          throw new NotFoundException(
            `Scenario with ID ${createSessionDto.scenarioId} not found. Either omit scenarioId or provide a valid scenario ID.`,
          );
        }
        if (meta?.constraint === 'Session_personaId_fkey') {
          throw new NotFoundException(
            `Persona with ID ${createSessionDto.personaId} not found. Either omit personaId or provide a valid persona ID.`,
          );
        }
      }

      this.logger.error(`Failed to create session: ${error}`);
      throw error;
    }
  }

  /**
   * Update a session
   */
  async update(
    id: string,
    updateSessionDto: UpdateSessionDto,
    requesterUserId?: string,
  ): Promise<SessionResponseDto> {
    this.logger.log(`Updating session: ${id}`);

    try {
      const existingSession = await this.sessionRepository.findById(id);
      if (!existingSession) {
        throw new NotFoundException(`Session with ID ${id} not found`);
      }

      if (existingSession.status === 'ended') {
        throw new BadRequestException(
          `Cannot update session ${id} because it has already ended`,
        );
      }

      this.assertOwner(existingSession, requesterUserId);

      const session = await this.sessionRepository.update(id, {
        orgId: updateSessionDto.orgId,
        orgSnapshot: updateSessionDto.orgSnapshot,
        name: updateSessionDto.name,
        type: updateSessionDto.type,
        tags: updateSessionDto.tags,
        sessionConfig: updateSessionDto.sessionConfig,
        scenarioId: updateSessionDto.scenarioId,
        personaId: updateSessionDto.personaId,
        language: updateSessionDto.language,
        crmContextId: updateSessionDto.crmContextId,
        status: updateSessionDto.status,
        endedReason: updateSessionDto.endedReason,
      });

      this.logger.log(`Updated session: ${session.id}`);
      return this.mapToResponseDto(session);
    } catch (error) {
      const err = error as PrismaError;
      if (err.code === 'P2025') {
        throw new NotFoundException(`Session with ID ${id} not found`);
      }
      throw error;
    }
  }

  /**
   * End a session
   */
  async end(
    id: string,
    endSessionDto: EndSessionDto,
    requesterUserId?: string,
  ): Promise<SessionResponseDto> {
    this.logger.log(
      `Ending session: ${id} with reason: ${endSessionDto.reason}`,
    );

    try {
      const existingSession = await this.sessionRepository.findById(id);
      if (!existingSession) {
        throw new NotFoundException(`Session with ID ${id} not found`);
      }

      if (existingSession.status === 'ended') {
        throw new BadRequestException(`Session ${id} has already ended`);
      }

      this.assertOwner(existingSession, requesterUserId);

      const session = await this.sessionRepository.end(
        id,
        endSessionDto.reason,
      );

      this.logger.log(`Ended session: ${session.id}`);
      return this.mapToResponseDto(session);
    } catch (error) {
      const err = error as PrismaError;
      if (err.code === 'P2025') {
        throw new NotFoundException(`Session with ID ${id} not found`);
      }
      throw error;
    }
  }

  /**
   * Delete a session
   */
  async remove(
    id: string,
    requesterUserId?: string,
  ): Promise<DeleteSessionResponseDto> {
    this.logger.log(`Deleting session: ${id}`);

    try {
      const existingSession = await this.sessionRepository.findById(id);
      if (!existingSession) {
        throw new NotFoundException(`Session with ID ${id} not found`);
      }

      this.assertOwner(existingSession, requesterUserId);

      await this.sessionRepository.delete(id);

      this.logger.log(`Deleted session: ${id}`);
      return {
        message: `Session ${id} has been deleted successfully`,
        id,
      };
    } catch (error) {
      const err = error as PrismaError;
      if (err.code === 'P2025') {
        throw new NotFoundException(`Session with ID ${id} not found`);
      }
      throw error;
    }
  }

  /**
   * Get active sessions for a user
   */
  async findActiveByUserId(userId: string): Promise<SessionResponseDto[]> {
    this.logger.log(`Finding active sessions for user: ${userId}`);

    const sessions = await this.sessionRepository.findActiveByUserId(userId);

    this.logger.log(
      `Found ${sessions.length} active sessions for user: ${userId}`,
    );
    return sessions.map(this.mapToResponseDto);
  }

  /**
   * Get active sessions for an organization
   */
  async findActiveByOrgId(orgId: string): Promise<SessionResponseDto[]> {
    this.logger.log(`Finding active sessions for organization: ${orgId}`);

    const sessions = await this.sessionRepository.findActiveByOrgId(orgId);

    this.logger.log(
      `Found ${sessions.length} active sessions for organization: ${orgId}`,
    );
    return sessions.map(this.mapToResponseDto);
  }

  /**
   * Map Prisma Session model to SessionResponseDto
   */
  private mapToResponseDto = (
    session: SessionWithOwner,
  ): SessionResponseDto => {
    const ownerMember = this.getOwnerMember(session);
    return {
      id: session.id,
      name: session.name ?? undefined,
      userId: ownerMember?.userId || '',
      orgId: session.orgId,
      userSnapshot: ownerMember?.userSnapshot as
        | Record<string, any>
        | undefined,
      orgSnapshot: session.orgSnapshot as Record<string, any> | undefined,
      type: session.type as SessionType,
      tags: session.tags,
      sessionConfig: session.sessionConfig as Record<string, any> | undefined,
      scenarioId: session.scenarioId || undefined,
      personaId: session.personaId || undefined,
      language: session.language || undefined,
      crmContextId: session.crmContextId || undefined,
      status: session.status,
      endedReason: session.endedReason || undefined,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      endedAt: session.endedAt || undefined,
    };
  };

  private getOwnerMember(session: SessionWithOwner): SessionMember | undefined {
    return session.members?.[0];
  }

  private assertOwner(
    session: SessionWithOwner,
    requesterUserId?: string,
  ): void {
    if (!requesterUserId) {
      throw new ForbiddenException('User identity is required');
    }

    const owner = this.getOwnerMember(session);
    if (!owner || owner.userId !== requesterUserId) {
      throw new ForbiddenException(
        `User ${requesterUserId} does not have permission to modify session ${session.id}`,
      );
    }
  }
}
