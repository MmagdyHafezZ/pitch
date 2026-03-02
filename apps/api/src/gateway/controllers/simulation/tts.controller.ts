import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  Inject,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiBearerAuth, ApiTags, ApiResponse } from '@nestjs/swagger';
import { catchError, timeout } from 'rxjs/operators';
import { throwError, lastValueFrom } from 'rxjs';
import type { Response } from 'express';
import { TTS_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { GlobalJwtAuthGuard } from '../../guards/global-jwt-auth.guard';
import { ServiceError } from '@pitch/shared-backend/interfaces/error.interface';
import {
  SpeakRequestDto,
  ProviderInfoDto,
  VoicesResponseDto,
} from './dtos/tts.dto';

type SpeakResponse = {
  audioBase64: string;
  contentType: string;
};

@ApiTags('tts')
@Controller({ path: 'tts', version: '1' })
@UseGuards(GlobalJwtAuthGuard)
@ApiBearerAuth('bearer')
export class TtsGatewayController {
  constructor(
    @Inject('SIMULATION_SERVICE') private readonly ttsService: ClientProxy,
  ) {}

  @Post('speak')
  @ApiResponse({
    status: 200,
    description: 'Audio file stream',
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async speak(@Body() body: SpeakRequestDto, @Res() res: Response) {
    const result = await lastValueFrom(
      this.ttsService
        .send<SpeakResponse>(TTS_SERVICE_PATTERNS.SPEAK, {
          text: body.text,
          provider: body.provider,
          options: { voice: body.voice, model: body.model },
        })
        .pipe(
          timeout(15000),
          catchError((err: unknown) => {
            const error = err as ServiceError;
            const message = error.message ?? 'Failed to synthesize speech';
            const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
            return throwError(() => new HttpException(message, status));
          }),
        ),
    );

    // Decode base64 audio back to Buffer
    const audioBuffer = Buffer.from(result.audioBase64, 'base64');

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Length', audioBuffer.length);
    res.setHeader('Accept-Ranges', 'bytes');
    res.send(audioBuffer);
  }

  @Post('stream')
  @ApiResponse({
    status: 200,
    description:
      'Stream audio back to the client as it is generated (chunked response)',
  })
  stream(@Body() body: SpeakRequestDto, @Res() res: Response) {
    const stream$ = this.ttsService.send<SpeakResponse>(
      TTS_SERVICE_PATTERNS.STREAM,
      {
        text: body.text,
        provider: body.provider,
        options: { voice: body.voice, model: body.model },
      },
    );

    let headersFlushed = false;

    const subscription = stream$.subscribe({
      next: (chunk) => {
        try {
          if (!headersFlushed) {
            // Use the provider's content type for the whole stream
            res.setHeader(
              'Content-Type',
              chunk.contentType || 'application/octet-stream',
            );
            res.setHeader('Transfer-Encoding', 'chunked');
            res.setHeader('Cache-Control', 'no-cache');
            res.flushHeaders();
            headersFlushed = true;
          }
          const buf = Buffer.from(chunk.audioBase64, 'base64');
          res.write(buf);
        } catch {
          // swallow individual chunk errors and continue
        }
      },
      error: () => {
        res.end();
      },
      complete: () => {
        res.end();
      },
    });

    // If client disconnects, unsubscribe from the microservice stream
    res.on('close', () => {
      subscription.unsubscribe();
    });
  }

  @Get('providers')
  @ApiResponse({
    status: 200,
    description: 'List of available TTS providers with their voices',
    type: [ProviderInfoDto],
  })
  listProviders() {
    return this.ttsService
      .send<ProviderInfoDto[]>(TTS_SERVICE_PATTERNS.LIST_PROVIDERS, {})
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          const message = error.message ?? 'Failed to list providers';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Get('voices')
  @ApiResponse({
    status: 200,
    description: 'List of available voices for a provider',
    type: VoicesResponseDto,
  })
  getVoices(@Query('provider') provider: string) {
    return this.ttsService
      .send<VoicesResponseDto>(TTS_SERVICE_PATTERNS.GET_VOICES, { provider })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          const message = error.message ?? 'Failed to get provider voices';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }
}
