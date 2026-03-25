import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { catchError, timeout } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';
import type { UserClaims as UserClaimsType } from '@pitch/shared-backend/interfaces/user-claims.interface';
import { UserClaims } from '../../decorators/user-claims.decorator';
import { GlobalJwtAuthGuard } from '../../guards/global-jwt-auth.guard';
import { UserClaimsInterceptor } from '../../interceptors/user-claims.interceptor';
import { CheckSystemAdmin } from '../../guards/check-system-admin.guard';
import { ApproveStudioAccessRequestDto } from '@microservices/userManagement/studio-access/dto/studio-access.dto';

@UseGuards(GlobalJwtAuthGuard)
@UseInterceptors(UserClaimsInterceptor)
@ApiBearerAuth('bearer')
@ApiTags('studio-access')
@Controller({ path: 'studio-access', version: '1' })
export class StudioAccessGatewayController {
  constructor(
    @Inject('USER_SERVICE') private readonly userService: ClientProxy,
  ) {}

  @Post('request')
  @ApiOperation({ summary: 'Request Studio access for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Studio access requested successfully',
  })
  requestAccess(@UserClaims() userClaims: UserClaimsType) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.REQUEST_STUDIO_ACCESS, {
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to request Studio access';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Get('requests')
  @UseGuards(CheckSystemAdmin)
  @ApiOperation({ summary: 'List pending Studio access requests' })
  @ApiResponse({
    status: 200,
    description: 'Studio access requests retrieved successfully',
  })
  listRequests(@UserClaims() userClaims: UserClaimsType) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.LIST_STUDIO_ACCESS_REQUESTS, {
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message =
            error.message ?? 'Failed to retrieve Studio access requests';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Post('requests/:userId/approve')
  @UseGuards(CheckSystemAdmin)
  @ApiOperation({
    summary: 'Approve a Studio access request and allocate quota',
  })
  @ApiResponse({
    status: 200,
    description: 'Studio access request approved successfully',
  })
  approveRequest(
    @Param('userId') userId: string,
    @Body() body: ApproveStudioAccessRequestDto,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.APPROVE_STUDIO_ACCESS_REQUEST, {
        userId,
        quota: body.quota,
        role: body.role,
        userClaims,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message =
            error.message ?? 'Failed to approve Studio access request';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Post('requests/:userId/deny')
  @UseGuards(CheckSystemAdmin)
  @ApiOperation({
    summary: 'Deny a Studio access request',
  })
  @ApiResponse({
    status: 200,
    description: 'Studio access request denied successfully',
  })
  denyRequest(
    @Param('userId') userId: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.DENY_STUDIO_ACCESS_REQUEST, {
        userId,
        userClaims,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message =
            error.message ?? 'Failed to deny Studio access request';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }
}
