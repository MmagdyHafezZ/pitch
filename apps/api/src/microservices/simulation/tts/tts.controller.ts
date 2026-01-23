import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { TtsService } from './tts.service';
import { writeFileSync, readFileSync } from 'fs';
import path from 'path';

@ApiTags('tts')
@ApiBearerAuth()
@Controller('tts')
export class TtsController {
  constructor(private readonly ttsService: TtsService) {}

  @Get('speak')
  @ApiQuery({ name: 'text', type: String, required: true })
  @ApiQuery({ name: 'provider', type: String, required: true })
  @ApiQuery({ name: 'voice', type: String, required: true })
  async speak(
    @Query('text') text: string,
    @Query('provider') provider: string,
    @Query('voice') voice: string,
    @Res() res,
  ) {
    const result = await this.ttsService.synthesize(text, provider, { voice });
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Length', result.audioBuffer.length);
    res.setHeader('Accept-Ranges', 'bytes');

    res.send(result.audioBuffer);
  }

  @Get('providers')
  listProviders() {
    return this.ttsService.listProviders();
  }

  @Get('voices')
  @ApiQuery({ name: 'provider', type: String, required: true })
  getVoices(@Query('provider') provider: string) {
    return {
      provider,
      voices: this.ttsService.getVoices(provider),
    };
  }
}
