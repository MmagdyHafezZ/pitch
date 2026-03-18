import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { PersonaService } from '../services/persona.service';
import { CreatePersonaDto } from '../dto/persona.dto';

@ApiTags('Simulation - Personas')
@Controller('simulation/personas')
export class PersonaHttpController {
  constructor(private readonly personaService: PersonaService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new persona' })
  @ApiResponse({ status: 201, description: 'Persona created successfully' })
  async createPersona(@Body() createPersonaDto: CreatePersonaDto) {
    return this.personaService.create(createPersonaDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all personas' })
  @ApiResponse({ status: 200, description: 'List of personas' })
  async listPersonas(@Query('orgId') orgId?: string) {
    return this.personaService.findAll(orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get persona by ID' })
  @ApiResponse({ status: 200, description: 'Persona details' })
  @ApiResponse({ status: 404, description: 'Persona not found' })
  async getPersona(@Param('id') id: string) {
    return this.personaService.findById(id);
  }

  @Get(':id/preview-audio')
  @ApiOperation({ summary: 'Stream cached or generated persona preview audio' })
  @ApiResponse({ status: 200, description: 'Persona preview audio stream' })
  @ApiResponse({ status: 404, description: 'Persona not found' })
  async getPersonaPreviewAudio(@Param('id') id: string, @Res() res: Response) {
    const audio = await this.personaService.getPreviewAudio(id);
    if (!audio) {
      throw new NotFoundException('Persona preview audio not available');
    }

    res.setHeader('Content-Type', audio.contentType);
    res.setHeader('Content-Length', audio.audioBuffer.length);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(audio.audioBuffer);
  }
}
