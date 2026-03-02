import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
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
}
