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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  CreateNoteDto,
  UpdateNoteDto,
  NoteResponseDto,
  NoteListQueryDto,
} from '../dto/note.dto';
import { NotImplementedResponse, notImplemented } from './common';

@ApiTags('CRM - Notes')
@ApiBearerAuth()
@Controller('crm/notes')
export class NotesController {
  @Get()
  @ApiOperation({
    summary: 'List all notes',
    description: 'Get a paginated list of notes with optional filters',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of notes',
    type: [NoteResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async listNotes(@Query() query: NoteListQueryDto) {
    return notImplemented('notes', 'List');
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get note by ID',
    description: 'Retrieve a single note by its ID',
  })
  @ApiParam({ name: 'id', description: 'Note ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Note details',
    type: NoteResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Note not found' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async getNote(@Param('id') id: string) {
    return notImplemented('note', 'Get');
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new note',
    description:
      'Create a new note associated with a contact, account, or opportunity',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Note created',
    type: NoteResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async createNote(@Body() dto: CreateNoteDto) {
    return notImplemented('note', 'Create');
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update a note',
    description: 'Update an existing note',
  })
  @ApiParam({ name: 'id', description: 'Note ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Note updated',
    type: NoteResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Note not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async updateNote(@Param('id') id: string, @Body() dto: UpdateNoteDto) {
    return notImplemented('note', 'Update');
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a note',
    description: 'Delete a note record',
  })
  @ApiParam({ name: 'id', description: 'Note ID' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Note deleted' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Note not found' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async deleteNote(@Param('id') id: string) {
    return notImplemented('note', 'Delete');
  }

  @Put(':id/pin')
  @ApiOperation({ summary: 'Pin a note', description: 'Pin a note to the top' })
  @ApiParam({ name: 'id', description: 'Note ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Note pinned',
    type: NoteResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Note not found' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async pinNote(@Param('id') id: string) {
    return notImplemented('note', 'Pin');
  }

  @Put(':id/unpin')
  @ApiOperation({ summary: 'Unpin a note', description: 'Unpin a pinned note' })
  @ApiParam({ name: 'id', description: 'Note ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Note unpinned',
    type: NoteResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Note not found' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async unpinNote(@Param('id') id: string) {
    return notImplemented('note', 'Unpin');
  }
}
