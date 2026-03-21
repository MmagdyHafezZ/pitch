import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Inject,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { catchError, timeout } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { CheckSystemAdmin } from '../../guards/check-system-admin.guard';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';
import {
  IEventLog,
  EventLogModel,
} from '../../../microservices/simulation/schemas/mongodb/event-log.schema';
import {
  IEnrichedTranscript,
  EnrichedTranscriptModel,
} from '../../../microservices/simulation/schemas/mongodb/enriched-transcript.schema';
import {
  ILLMTrace,
  LLMTraceModel,
} from '../../../microservices/simulation/schemas/mongodb/llm-trace.schema';

@Controller({ path: 'admin/sessions', version: '1' })
@UseGuards(CheckSystemAdmin)
export class AdminSessionsController {
  constructor(
    @Inject('SIMULATION_SERVICE')
    private readonly simulationService: ClientProxy,
    @InjectModel(EventLogModel, 'gateway')
    private readonly eventLogModel: Model<IEventLog>,
    @InjectModel(EnrichedTranscriptModel, 'gateway')
    private readonly transcriptModel: Model<IEnrichedTranscript>,
    @InjectModel(LLMTraceModel, 'gateway')
    private readonly llmTraceModel: Model<ILLMTrace>,
  ) {}

  @Get()
  listSessions(
    @Query('userId') userId?: string,
    @Query('orgId') orgId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.LIST_SESSIONS, {
        userId,
        orgId,
        status,
        type,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to list sessions',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Get(':id')
  getSession(@Param('id') id: string) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.GET_SESSION, { sessionId: id })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to get session',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Get(':id/events')
  async getSessionEvents(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const lim = limit ? parseInt(limit, 10) : 100;
    const skip = offset ? parseInt(offset, 10) : 0;

    const [events, total] = await Promise.all([
      this.eventLogModel
        .find({ 'context.sessionId': id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean()
        .exec(),
      this.eventLogModel.countDocuments({ 'context.sessionId': id }).exec(),
    ]);

    return { events, total };
  }

  @Get(':id/transcript')
  async getSessionTranscript(@Param('id') id: string) {
    const transcript = await this.transcriptModel
      .findOne({ iterationId: id })
      .lean()
      .exec();

    if (!transcript) {
      throw new HttpException('Transcript not found', HttpStatus.NOT_FOUND);
    }

    return transcript;
  }

  @Get(':id/llm-calls')
  async getSessionLlmCalls(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const lim = limit ? parseInt(limit, 10) : 50;
    const skip = offset ? parseInt(offset, 10) : 0;

    const [traces, total] = await Promise.all([
      this.llmTraceModel
        .find({ iterationId: id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean()
        .exec(),
      this.llmTraceModel.countDocuments({ iterationId: id }).exec(),
    ]);

    return { traces, total };
  }

  @Post(':id/force-end')
  forceEndSession(@Param('id') id: string) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.END_SESSION, {
        sessionId: id,
        reason: 'force-ended by admin',
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to force-end session',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Post(':id/recompute')
  recomputeAssessment(@Param('id') id: string) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.ASSESSMENT_RUN, {
        sessionId: id,
        mode: 'final',
        forceRecalculate: true,
        requestedBy: 'admin',
      })
      .pipe(
        timeout(30000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to recompute assessment',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }
}
