import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { NotesService } from '../services/notes.service';
import {
  CreateNoteDto,
  UpdateNoteDto,
  NoteResponseDto,
  NoteListQueryDto,
} from '../dto/note.dto';

// TODO: Replace with actual user claims from JWT
const MOCK_ORG_ID = 'org_test_123';
const MOCK_USER_ID = 'user_test_123';

@ApiTags('CRM - Notes')
@ApiBearerAuth()
@Controller('crm/notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  @ApiOperation({ summary: 'List all notes' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of notes' })
  async listNotes(@Query() query: NoteListQueryDto) {
    return this.notesService.findAll(MOCK_ORG_ID, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get note by ID' })
  @ApiParam({ name: 'id', description: 'Note ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Note details',
    type: NoteResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Note not found' })
  async getNote(@Param('id') id: string) {
    return this.notesService.findById(id, MOCK_ORG_ID);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new note' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Note created',
    type: NoteResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  async createNote(@Body() dto: CreateNoteDto) {
    return this.notesService.create(MOCK_ORG_ID, MOCK_USER_ID, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a note' })
  @ApiParam({ name: 'id', description: 'Note ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Note updated',
    type: NoteResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Note not found' })
  async updateNote(@Param('id') id: string, @Body() dto: UpdateNoteDto) {
    return this.notesService.update(id, MOCK_ORG_ID, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a note' })
  @ApiParam({ name: 'id', description: 'Note ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Note deleted' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Note not found' })
  async deleteNote(@Param('id') id: string) {
    return this.notesService.delete(id, MOCK_ORG_ID);
  }

  @Post(':id/toggle-pin')
  @ApiOperation({ summary: 'Toggle pin status of a note' })
  @ApiParam({ name: 'id', description: 'Note ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Pin status toggled' })
  async togglePin(@Param('id') id: string) {
    return this.notesService.togglePin(id, MOCK_ORG_ID);
  }
}
