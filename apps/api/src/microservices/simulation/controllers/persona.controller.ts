import { Body, Controller, Post, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  PersonaService,
  PersonaResponseDto,
  PersonaListResponseDto,
} from '../services/persona.service';
import { CreatePersonaDto } from '../dto/persona.dto';

@ApiTags('Personas')
@Controller('simulation/personas')
export class PersonaController {
  constructor(private readonly personaService: PersonaService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new persona' })
  @ApiResponse({
    status: 201,
    description: 'The persona has been successfully created.',
  })
  async create(
    @Body() createPersonaDto: CreatePersonaDto,
  ): Promise<PersonaResponseDto> {
    return this.personaService.create(createPersonaDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all personas' })
  async findAll(
    @Query('orgId') orgId?: string,
  ): Promise<PersonaListResponseDto> {
    return this.personaService.findAll(orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a persona by ID' })
  async findOne(@Param('id') id: string): Promise<PersonaResponseDto> {
    return this.personaService.findById(id);
  }
}
