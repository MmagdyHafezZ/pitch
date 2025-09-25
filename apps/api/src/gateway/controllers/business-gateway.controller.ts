import { Controller, Get, Post, Put, Delete, Body, Param, Inject, HttpException, HttpStatus, UseGuards, UseInterceptors } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { catchError, timeout } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { BUSINESS_SERVICE_PATTERNS } from '../../common/interfaces/message-patterns.interface';
import type { CreateBusinessDto, UpdateBusinessDto } from '../../common/interfaces/business.interface';
import { GlobalJwtAuthGuard } from '../guards/global-jwt-auth.guard';
import { UserClaimsInterceptor } from '../interceptors/user-claims.interceptor';
import { UserClaims } from '../decorators/user-claims.decorator';

@ApiTags('businesses')
@Controller({ path: 'businesses', version: '1' })
@UseGuards(GlobalJwtAuthGuard)
@UseInterceptors(UserClaimsInterceptor)
@ApiBearerAuth('bearer')
export class BusinessGatewayController {
  constructor(@Inject('BUSINESS_SERVICE') private businessService: ClientProxy) {}

  @Get()
  @ApiOperation({ summary: 'Get all businesses' })
  @ApiResponse({ status: 200, description: 'Businesses retrieved successfully' })
  async getBusinesses(@UserClaims() userClaims: any) {
    return this.businessService.send(BUSINESS_SERVICE_PATTERNS.GET_BUSINESSES, {
      userClaims
    }).pipe(
      timeout(5000),
      catchError((error) => {
        throw new HttpException(error.message || 'Failed to get businesses', error.status || HttpStatus.INTERNAL_SERVER_ERROR);
      })
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get business by ID with user details' })
  @ApiResponse({ status: 200, description: 'Business retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  async getBusinessById(@Param('id') id: string, @UserClaims() userClaims: any) {
    return this.businessService.send(BUSINESS_SERVICE_PATTERNS.GET_BUSINESS_WITH_USER, {
      id,
      userClaims
    }).pipe(
      timeout(5000),
      catchError((error) => {
        throw new HttpException(error.message || 'Failed to get business', error.status || HttpStatus.INTERNAL_SERVER_ERROR);
      })
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create new business' })
  @ApiResponse({ status: 201, description: 'Business created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async createBusiness(@Body() createBusinessDto: CreateBusinessDto, @UserClaims() userClaims: any) {
    return this.businessService.send(BUSINESS_SERVICE_PATTERNS.CREATE_BUSINESS, {
      ...createBusinessDto,
      userClaims
    }).pipe(
      timeout(5000),
      catchError((error) => {
        throw new HttpException(error.message || 'Failed to create business', error.status || HttpStatus.INTERNAL_SERVER_ERROR);
      })
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update business' })
  @ApiResponse({ status: 200, description: 'Business updated successfully' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  async updateBusiness(@Param('id') id: string, @Body() updateBusinessDto: UpdateBusinessDto, @UserClaims() userClaims: any) {
    return this.businessService.send(BUSINESS_SERVICE_PATTERNS.UPDATE_BUSINESS, {
      id,
      ...updateBusinessDto,
      userClaims
    }).pipe(
      timeout(5000),
      catchError((error) => {
        throw new HttpException(error.message || 'Failed to update business', error.status || HttpStatus.INTERNAL_SERVER_ERROR);
      })
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete business' })
  @ApiResponse({ status: 200, description: 'Business deleted successfully' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  async deleteBusiness(@Param('id') id: string, @UserClaims() userClaims: any) {
    return this.businessService.send(BUSINESS_SERVICE_PATTERNS.DELETE_BUSINESS, {
      id,
      userClaims
    }).pipe(
      timeout(5000),
      catchError((error) => {
        throw new HttpException(error.message || 'Failed to delete business', error.status || HttpStatus.INTERNAL_SERVER_ERROR);
      })
    );
  }
}