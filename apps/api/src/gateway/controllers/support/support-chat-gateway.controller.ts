import {
  Controller,
  Post,
  Body,
  Inject,
  HttpException,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  Res,
  Logger,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { catchError, timeout } from 'rxjs/operators';
import { throwError } from 'rxjs';
import type { Response } from 'express';
import { SUPPORT_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { GlobalJwtAuthGuard } from '../../guards/global-jwt-auth.guard';
import { UserClaimsInterceptor } from '../../interceptors/user-claims.interceptor';
import { UserClaims } from '../../decorators/user-claims.decorator';
import type { UserClaims as UserClaimsType } from '@pitch/shared-backend/interfaces/user-claims.interface';
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';
import { CoachStreamService } from './coach-stream.service';
import type { StreamItem, Attachment } from './coach-stream.service';

interface CoachChatRequest {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    attachments?: Attachment[];
  }>;
  context?: {
    page?: string;
    sessionId?: string;
    recentTurns?: Array<{ role: string; text: string }>;
  };
}

@ApiTags('support')
@Controller({ path: 'support/chat', version: '1' })
@UseGuards(GlobalJwtAuthGuard)
@UseInterceptors(UserClaimsInterceptor)
@ApiBearerAuth('bearer')
export class SupportChatGatewayController {
  private readonly logger = new Logger(SupportChatGatewayController.name);

  constructor(
    @Inject('SUPPORT_SERVICE') private readonly supportService: ClientProxy,
    private readonly coachStreamService: CoachStreamService,
  ) {}

  /**
   * POST /v1/support/chat
   * Non-streaming fallback via RabbitMQ
   */
  @Post()
  @ApiOperation({ summary: 'Chat with PITCH AI Coach' })
  @ApiResponse({ status: 200, description: 'Coach reply returned' })
  chat(
    @Body() body: CoachChatRequest,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.supportService
      .send(SUPPORT_SERVICE_PATTERNS.CHAT, {
        messages: body.messages,
        context: body.context,
        userId: userClaims.id,
      })
      .pipe(
        timeout(30000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to get coach response',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  /**
   * POST /v1/support/chat/stream
   * Streaming SSE endpoint — calls OpenAI directly in-process, bypasses RabbitMQ.
   * Client reads via fetch() + ReadableStream (not EventSource, which only supports GET).
   */
  @Post('stream')
  @ApiOperation({ summary: 'Stream chat with PITCH AI Coach (SSE)' })
  @ApiResponse({
    status: 200,
    description: 'Server-sent events stream of token deltas',
  })
  async chatStream(@Body() body: CoachChatRequest, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // Prevent nginx / any reverse-proxy from buffering SSE frames
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // compression() middleware (if active) wraps res.write — calling res.flush()
    // after each write drains its internal buffer so tokens reach the client immediately.
    const flush = () => (res as Response & { flush?: () => void }).flush?.();

    try {
      for await (const item of this.coachStreamService.stream(
        body.messages ?? [],
        body.context,
      )) {
        if (typeof item === 'string') {
          res.write(`data: ${JSON.stringify({ delta: item })}\n\n`);
        } else {
          res.write(`data: ${JSON.stringify(item)}\n\n`);
        }
        flush();
      }
    } catch (err) {
      this.logger.error('chatStream error', err as Error);
      res.write(
        `data: ${JSON.stringify({ error: 'Failed to generate response' })}\n\n`,
      );
      flush();
    } finally {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
}
