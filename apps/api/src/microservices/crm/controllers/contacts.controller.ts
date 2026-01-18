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
  CreateContactDto,
  UpdateContactDto,
  ContactResponseDto,
  ContactListQueryDto,
} from '../dto/contact.dto';
import { AssignTagsDto } from '../dto/tag.dto';
import { NotImplementedResponse, notImplemented } from './common';

@ApiTags('CRM - Contacts')
@ApiBearerAuth()
@Controller('crm/contacts')
export class ContactsController {
  @Get()
  @ApiOperation({
    summary: 'List all contacts',
    description: 'Get a paginated list of contacts with optional filters',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of contacts',
    type: [ContactResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async listContacts(@Query() query: ContactListQueryDto) {
    return notImplemented('contacts', 'List');
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get contact by ID',
    description: 'Retrieve a single contact by its ID',
  })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Contact details',
    type: ContactResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Contact not found',
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async getContact(@Param('id') id: string) {
    return notImplemented('contact', 'Get');
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new contact',
    description: 'Create a new contact record',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Contact created',
    type: ContactResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async createContact(@Body() dto: CreateContactDto) {
    return notImplemented('contact', 'Create');
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update a contact',
    description: 'Update an existing contact record',
  })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Contact updated',
    type: ContactResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Contact not found',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async updateContact(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return notImplemented('contact', 'Update');
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a contact',
    description: 'Delete a contact record',
  })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Contact deleted',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Contact not found',
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async deleteContact(@Param('id') id: string) {
    return notImplemented('contact', 'Delete');
  }

  @Get(':id/activities')
  @ApiOperation({
    summary: 'Get contact activities',
    description: 'Get all activities associated with a contact',
  })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of activities' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async getContactActivities(@Param('id') id: string) {
    return notImplemented('contact activities', 'Get');
  }

  @Get(':id/opportunities')
  @ApiOperation({
    summary: 'Get contact opportunities',
    description: 'Get all opportunities associated with a contact',
  })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of opportunities' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async getContactOpportunities(@Param('id') id: string) {
    return notImplemented('contact opportunities', 'Get');
  }

  @Get(':id/notes')
  @ApiOperation({
    summary: 'Get contact notes',
    description: 'Get all notes associated with a contact',
  })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of notes' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async getContactNotes(@Param('id') id: string) {
    return notImplemented('contact notes', 'Get');
  }

  @Get(':id/tasks')
  @ApiOperation({
    summary: 'Get contact tasks',
    description: 'Get all tasks associated with a contact',
  })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of tasks' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async getContactTasks(@Param('id') id: string) {
    return notImplemented('contact tasks', 'Get');
  }

  @Get(':id/emails')
  @ApiOperation({
    summary: 'Get contact email threads',
    description: 'Get all email threads associated with a contact',
  })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of email threads' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async getContactEmails(@Param('id') id: string) {
    return notImplemented('contact emails', 'Get');
  }

  @Put(':id/tags')
  @ApiOperation({
    summary: 'Assign tags to contact',
    description: 'Replace all tags on a contact',
  })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tags assigned',
    type: ContactResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async assignTags(@Param('id') id: string, @Body() dto: AssignTagsDto) {
    return notImplemented('contact tags', 'Assign');
  }

  @Post(':id/tags/:tagId')
  @ApiOperation({
    summary: 'Add tag to contact',
    description: 'Add a single tag to a contact',
  })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  @ApiParam({ name: 'tagId', description: 'Tag ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Tag added' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async addTag(@Param('id') id: string, @Param('tagId') tagId: string) {
    return notImplemented('contact tag', 'Add');
  }

  @Delete(':id/tags/:tagId')
  @ApiOperation({
    summary: 'Remove tag from contact',
    description: 'Remove a single tag from a contact',
  })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  @ApiParam({ name: 'tagId', description: 'Tag ID' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Tag removed' })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Not implemented',
    type: NotImplementedResponse,
  })
  async removeTag(@Param('id') id: string, @Param('tagId') tagId: string) {
    return notImplemented('contact tag', 'Remove');
  }
}
