import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Readable } from 'stream';
import type { Request, Response } from 'express';
import { Public } from '../../../microservices/userManagement/decorators/public.decorator';
import { VideoGenerationService } from '@microservices/simulation/services/video-generation.service';

@ApiTags('simulation-video')
@Controller({ path: 'simulation', version: '1' })
export class VideoGenerationController {
  private readonly logger = new Logger(VideoGenerationController.name);

  constructor(
    private readonly videoGenerationService: VideoGenerationService,
  ) {}

  @Get('video-assets/audio/:jobId')
  @Public()
  @ApiOperation({
    summary: 'Serve a temporary TTS asset for avatar generation',
  })
  async getVideoAudioAsset(
    @Param('jobId') jobId: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const asset = await this.videoGenerationService.getVideoAudioAsset(
      jobId,
      token,
    );
    if (!asset) {
      throw new NotFoundException('Video audio asset not found');
    }

    res.setHeader('Content-Type', asset.contentType);
    res.setHeader('Content-Length', asset.audioBuffer.length);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(asset.audioBuffer);
  }

  @Post('video/webhooks/heygen')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle HeyGen avatar video callbacks' })
  async handleHeyGenWebhook(@Body() body: Record<string, unknown>) {
    this.logger.debug(`HeyGen callback received: ${JSON.stringify(body)}`);
    await this.videoGenerationService.handleHeyGenCallback(body);
    return { ok: true };
  }

  @Post('video/live-avatar/session')
  @ApiOperation({
    summary: 'Create a realtime LiveAvatar session token for a video session',
  })
  async createLiveAvatarSession(@Body() body: { sessionId?: string }) {
    const sessionId = body?.sessionId?.trim();
    if (!sessionId) {
      throw new BadRequestException('sessionId is required');
    }

    return this.videoGenerationService.createLiveAvatarSessionToken(sessionId);
  }

  @Get('video/stream/:sessionId')
  @Public()
  @ApiOperation({
    summary: 'Proxy a rendered avatar video stream to the frontend',
  })
  async streamVideoAsset(
    @Param('sessionId') sessionId: string,
    @Query('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const upstream = await this.videoGenerationService.getVideoStreamResponse(
      sessionId,
      token,
      req.headers.range,
    );
    if (!upstream) {
      throw new NotFoundException('Rendered video stream not available');
    }

    res.status(upstream.status);

    for (const header of [
      'content-type',
      'content-length',
      'accept-ranges',
      'content-range',
      'cache-control',
      'etag',
      'last-modified',
    ]) {
      const value = upstream.headers.get(header);
      if (value) {
        res.setHeader(header, value);
      }
    }

    if (!res.getHeader('Cache-Control')) {
      res.setHeader('Cache-Control', 'private, max-age=300');
    }

    if (!upstream.body) {
      res.end();
      return;
    }

    Readable.fromWeb(upstream.body as never).pipe(res);
  }
}
