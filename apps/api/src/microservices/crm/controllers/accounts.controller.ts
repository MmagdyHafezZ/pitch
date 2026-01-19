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
import { AccountsService } from '../services/accounts.service';
import {
  CreateAccountDto,
  UpdateAccountDto,
  AccountResponseDto,
  AccountListQueryDto,
} from '../dto/account.dto';

// TODO: Replace with actual user claims from JWT
const MOCK_ORG_ID = 'org_test_123';

@ApiTags('CRM - Accounts')
@ApiBearerAuth()
@Controller('crm/accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all accounts',
    description: 'Get a paginated list of accounts with optional filters',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of accounts' })
  async listAccounts(@Query() query: AccountListQueryDto) {
    return this.accountsService.findAll(MOCK_ORG_ID, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get account by ID' })
  @ApiParam({ name: 'id', description: 'Account ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Account details',
    type: AccountResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Account not found',
  })
  async getAccount(@Param('id') id: string) {
    return this.accountsService.findById(id, MOCK_ORG_ID);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new account' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Account created',
    type: AccountResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  async createAccount(@Body() dto: CreateAccountDto) {
    return this.accountsService.create(MOCK_ORG_ID, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an account' })
  @ApiParam({ name: 'id', description: 'Account ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Account updated',
    type: AccountResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Account not found',
  })
  async updateAccount(@Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.accountsService.update(id, MOCK_ORG_ID, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an account' })
  @ApiParam({ name: 'id', description: 'Account ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Account deleted' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Account not found',
  })
  async deleteAccount(@Param('id') id: string) {
    return this.accountsService.delete(id, MOCK_ORG_ID);
  }

  @Get(':id/contacts')
  @ApiOperation({ summary: 'Get account contacts' })
  @ApiParam({ name: 'id', description: 'Account ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of contacts' })
  async getAccountContacts(@Param('id') id: string) {
    return this.accountsService.getContacts(id, MOCK_ORG_ID);
  }

  @Get(':id/opportunities')
  @ApiOperation({ summary: 'Get account opportunities' })
  @ApiParam({ name: 'id', description: 'Account ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of opportunities' })
  async getAccountOpportunities(@Param('id') id: string) {
    return this.accountsService.getOpportunities(id, MOCK_ORG_ID);
  }
}
