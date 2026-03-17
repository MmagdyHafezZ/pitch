import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Inject,
  HttpException,
  HttpStatus,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { catchError, timeout } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import type {
  CreateUserDto,
  UpdateUserDto,
  UserSettings,
} from '@pitch/shared-backend/interfaces/user.interface';
import { GlobalJwtAuthGuard } from '../../guards/global-jwt-auth.guard';
import { UserClaimsInterceptor } from '../../interceptors/user-claims.interceptor';
import { UserClaims } from '../../decorators/user-claims.decorator';
import type { UserClaims as UserClaimsType } from '@pitch/shared-backend/interfaces/user-claims.interface';
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';

@ApiTags('users')
@Controller({ path: 'users', version: '1' })
@UseGuards(GlobalJwtAuthGuard)
@UseInterceptors(UserClaimsInterceptor)
@ApiBearerAuth('bearer')
export class UserGatewayController {
  constructor(@Inject('USER_SERVICE') private userService: ClientProxy) {}

  private updateCurrentUserAvatar(userClaims: UserClaimsType, avatar: string) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.UPDATE_USER, {
        userId: userClaims.id,
        avatar,
        userClaims,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to update profile picture';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  getUsers(@UserClaims() userClaims: UserClaimsType) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.GET_USERS, {
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to get users';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Get('me/settings')
  @ApiOperation({ summary: 'Get current user settings' })
  @ApiResponse({
    status: 200,
    description: 'User settings retrieved successfully',
  })
  getMySettings(@UserClaims() userClaims: UserClaimsType) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.GET_MY_SETTINGS, {
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to get user settings';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Get('me/phone-verification')
  @ApiOperation({ summary: 'Get current user phone verification status' })
  @ApiResponse({
    status: 200,
    description: 'Phone verification status retrieved successfully',
  })
  getMyPhoneVerification(@UserClaims() userClaims: UserClaimsType) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.GET_MY_PHONE_VERIFICATION, {
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message =
            error.message ?? 'Failed to get phone verification status';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getUserById(
    @Param('userId') userId: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.GET_USER, {
        userId,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to get user';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Post()
  @ApiOperation({ summary: 'Create new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  createUser(
    @Body() createUserDto: CreateUserDto,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.CREATE_USER, {
        ...createUserDto,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to create user';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Put('me/settings')
  @ApiOperation({ summary: 'Update current user settings' })
  @ApiResponse({
    status: 200,
    description: 'User settings updated successfully',
  })
  updateMySettings(
    @Body() body: { settings?: UserSettings } | UserSettings,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    const settings =
      body && 'settings' in (body as Record<string, unknown>)
        ? ((body as { settings?: UserSettings }).settings ?? {})
        : (body as UserSettings);

    return this.userService
      .send(USER_SERVICE_PATTERNS.UPDATE_MY_SETTINGS, {
        settings,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to update user settings';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Post('me/phone-verification/request')
  @ApiOperation({ summary: 'Request a phone verification challenge' })
  @ApiResponse({
    status: 200,
    description: 'Phone verification challenge requested successfully',
  })
  requestPhoneVerification(
    @Body() body: { phoneNumber: string },
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.REQUEST_PHONE_VERIFICATION, {
        phoneNumber: body.phoneNumber,
        userClaims,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message =
            error.message ?? 'Failed to request phone verification';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Post('me/phone-verification/resend')
  @ApiOperation({ summary: 'Resend the pending phone verification challenge' })
  @ApiResponse({
    status: 200,
    description: 'Phone verification challenge resent successfully',
  })
  resendPhoneVerification(@UserClaims() userClaims: UserClaimsType) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.RESEND_PHONE_VERIFICATION, {
        userClaims,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message =
            error.message ?? 'Failed to resend phone verification';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Post('me/phone-verification/verify')
  @ApiOperation({ summary: 'Verify the pending phone verification code' })
  @ApiResponse({
    status: 200,
    description: 'Phone number verified successfully',
  })
  verifyPhoneVerification(
    @Body() body: { code: string },
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.VERIFY_PHONE_VERIFICATION, {
        code: body.code,
        userClaims,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to verify the phone number';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Put('me/avatar')
  @ApiOperation({ summary: 'Upload or update current user profile picture' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (jpg/png/webp/gif, max 2MB)',
        },
        avatarUrl: {
          type: 'string',
          description:
            'Direct URL to use as avatar instead of uploading a file',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Profile picture updated successfully',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  updateMyAvatar(
    @UploadedFile()
    file:
      | {
          mimetype: string;
          buffer: Buffer;
        }
      | undefined,
    @Body() body: { avatarUrl?: string; avatar?: string },
    @UserClaims() userClaims: UserClaimsType,
  ) {
    let avatar: string | null = null;

    if (file) {
      const allowed = new Set([
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
      ]);

      if (!allowed.has(file.mimetype)) {
        throw new HttpException(
          'Invalid image type. Allowed: jpeg, png, webp, gif',
          HttpStatus.BAD_REQUEST,
        );
      }

      avatar = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    } else {
      const candidate = body?.avatarUrl ?? body?.avatar;
      if (typeof candidate === 'string' && candidate.trim()) {
        avatar = candidate.trim();
      }
    }

    if (!avatar) {
      throw new HttpException(
        'Provide an image file (`file`) or an `avatarUrl`',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.updateCurrentUserAvatar(userClaims, avatar);
  }

  @Put(':userId')
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  updateUser(
    @Param('userId') userId: string,
    @Body() updateUserDto: UpdateUserDto,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.UPDATE_USER, {
        userId,
        ...updateUserDto,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to update user';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  deleteUser(
    @Param('userId') userId: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.DELETE_USER, {
        userId,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to delete user';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }
}
