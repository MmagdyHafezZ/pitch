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
import { ContactsService } from '../services/contacts.service';
import {
  CreateContactDto,
  UpdateContactDto,
  ContactResponseDto,
  ContactListQueryDto,
} from '../dto/contact.dto';
import { AssignTagsDto } from '../dto/tag.dto';

// TODO: Replace with actual user claims from JWT
const MOCK_ORG_ID = 'org_test_123';

@ApiTags('CRM - Contacts')
@ApiBearerAuth()
@Controller('crm/contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all contacts',
    description: 'Get a paginated list of contacts with optional filters',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of contacts' })
  async listContacts(@Query() query: ContactListQueryDto) {
    return this.contactsService.findAll(MOCK_ORG_ID, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contact by ID' })
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
  async getContact(@Param('id') id: string) {
    return this.contactsService.findById(id, MOCK_ORG_ID);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new contact' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Contact created',
    type: ContactResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  async createContact(@Body() dto: CreateContactDto) {
    return this.contactsService.create(MOCK_ORG_ID, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a contact' })
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
  async updateContact(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contactsService.update(id, MOCK_ORG_ID, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a contact' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Contact deleted' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Contact not found',
  })
  async deleteContact(@Param('id') id: string) {
    return this.contactsService.delete(id, MOCK_ORG_ID);
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
  async assignTags(@Param('id') id: string, @Body() dto: AssignTagsDto) {
    return this.contactsService.assignTags(id, MOCK_ORG_ID, dto.tagIds);
  }

  @Post(':id/tags/:tagId')
  @ApiOperation({ summary: 'Add tag to contact' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  @ApiParam({ name: 'tagId', description: 'Tag ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Tag added' })
  async addTag(@Param('id') id: string, @Param('tagId') tagId: string) {
    return this.contactsService.addTag(id, MOCK_ORG_ID, tagId);
  }

  @Delete(':id/tags/:tagId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove tag from contact' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  @ApiParam({ name: 'tagId', description: 'Tag ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Tag removed' })
  async removeTag(@Param('id') id: string, @Param('tagId') tagId: string) {
    return this.contactsService.removeTag(id, MOCK_ORG_ID, tagId);
  }
}
