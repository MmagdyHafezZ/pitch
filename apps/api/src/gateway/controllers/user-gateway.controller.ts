import { Controller, Get, Post, Put, Delete, Body, Param, Inject, HttpException, HttpStatus, UseGuards, UseInterceptors } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { catchError, timeout } from 'rxjs/operators';
import { throwError, of } from 'rxjs';
import { USER_SERVICE_PATTERNS } from '../../common/interfaces/message-patterns.interface';
import type { CreateUserDto, UpdateUserDto } from '../../common/interfaces/user.interface';
import { GlobalJwtAuthGuard } from '../guards/global-jwt-auth.guard';
import { UserClaimsInterceptor } from '../interceptors/user-claims.interceptor';
import { UserClaims } from '../decorators/user-claims.decorator';

@ApiTags('users')
@Controller({ path: 'users', version: '1' })
@UseGuards(GlobalJwtAuthGuard)
@UseInterceptors(UserClaimsInterceptor)
@ApiBearerAuth('bearer')
export class UserGatewayController {
  constructor(@Inject('USER_SERVICE') private userService: ClientProxy) {}

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async getUsers(@UserClaims() userClaims: any) {
    return this.userService.send(USER_SERVICE_PATTERNS.GET_USERS, {
      userClaims
    }).pipe(
      timeout(5000),
      catchError((error) => {
        throw new HttpException(error.message || 'Failed to get users', error.status || HttpStatus.INTERNAL_SERVER_ERROR);
      })
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id') id: string, @UserClaims() userClaims: any) {
    return this.userService.send(USER_SERVICE_PATTERNS.GET_USER, {
      id,
      userClaims
    }).pipe(
      timeout(5000),
      catchError((error) => {
        throw new HttpException(error.message || 'Failed to get user', error.status || HttpStatus.INTERNAL_SERVER_ERROR);
      })
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async createUser(@Body() createUserDto: CreateUserDto, @UserClaims() userClaims: any) {
    return this.userService.send(USER_SERVICE_PATTERNS.CREATE_USER, {
      ...createUserDto,
      userClaims
    }).pipe(
      timeout(5000),
      catchError((error) => {
        throw new HttpException(error.message || 'Failed to create user', error.status || HttpStatus.INTERNAL_SERVER_ERROR);
      })
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUser(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @UserClaims() userClaims: any) {
    return this.userService.send(USER_SERVICE_PATTERNS.UPDATE_USER, {
      id,
      ...updateUserDto,
      userClaims
    }).pipe(
      timeout(5000),
      catchError((error) => {
        throw new HttpException(error.message || 'Failed to update user', error.status || HttpStatus.INTERNAL_SERVER_ERROR);
      })
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(@Param('id') id: string, @UserClaims() userClaims: any) {
    return this.userService.send(USER_SERVICE_PATTERNS.DELETE_USER, {
      id,
      userClaims
    }).pipe(
      timeout(5000),
      catchError((error) => {
        throw new HttpException(error.message || 'Failed to delete user', error.status || HttpStatus.INTERNAL_SERVER_ERROR);
      })
    );
  }
}