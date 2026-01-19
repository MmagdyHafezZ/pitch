import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { TtsService } from './tts.service';

@ApiTags('tts')
@ApiBearerAuth()
@Controller('tts')
export class TtsController {
  constructor(private readonly ttsService: TtsService) {}

  @Get('speak')
  async speak(
    @Query('text') text: string,
    @Query('provider') provider?: string,
    // @Res() res: Response,
  ) {
    const result = await this.ttsService.synthesize(text, provider);

    // res.setHeader('Content-Type', result.contentType);
    // res.send(result.audioBuffer);
  }

  @Get('providers')
  listProviders() {
    return this.ttsService.listProviders();
  }
}
