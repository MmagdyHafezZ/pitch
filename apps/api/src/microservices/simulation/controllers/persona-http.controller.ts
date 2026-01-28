import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PersonaService } from '../services/persona.service';

@ApiTags('Simulation - Personas')
@Controller('simulation/personas')
export class PersonaHttpController {
  constructor(private readonly personaService: PersonaService) {}

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
}
