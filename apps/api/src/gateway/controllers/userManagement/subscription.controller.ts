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
  UseGuards,
  UseInterceptors,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { catchError, timeout } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { GlobalJwtAuthGuard } from '../../guards/global-jwt-auth.guard';
import { UserClaimsInterceptor } from '../../interceptors/user-claims.interceptor';
import { UserClaims } from '../../decorators/user-claims.decorator';
import type { UserClaims as UserClaimsType } from '@pitch/shared-backend/interfaces/user-claims.interface';
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';
import {
  CreateSubscriptionRequestDTO,
  UpdateSubscriptionRequestDTO,
} from '@microservices/userManagement/subscription/dto/subscription.dto';

@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
@UseGuards(GlobalJwtAuthGuard)
@UseInterceptors(UserClaimsInterceptor)
@ApiBearerAuth('bearer')
@ApiTags('subscriptions')
@Controller({ path: 'subscriptions', version: '1' })
export class SubscriptionGatewayController {
  constructor(
    @Inject('USER_SERVICE') private readonly userService: ClientProxy,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create new subscription' })
  @ApiResponse({
    status: 201,
    description: 'Subscription created successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  createSubscription(
    @Body() createSubscriptionDto: CreateSubscriptionRequestDTO,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.CREATE_SUBSCRIPTION, {
        ...createSubscriptionDto,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to create subscription';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update subscription' })
  @ApiResponse({
    status: 200,
    description: 'Subscription updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  updateSubscription(
    @Param('id') id: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionRequestDTO,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.UPDATE_SUBSCRIPTION, {
        id,
        ...updateSubscriptionDto,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to update subscription';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete subscription' })
  @ApiResponse({
    status: 200,
    description: 'Subscription deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  deleteSubscription(
    @Param('id') id: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.DELETE_SUBSCRIPTION, {
        id,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to delete subscription';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Get()
  @ApiOperation({ summary: 'Get all subscriptions' })
  @ApiResponse({
    status: 200,
    description: 'Subscriptions retrieved successfully',
  })
  getSubscriptions(@UserClaims() userClaims: UserClaimsType) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.GET_SUBSCRIPTIONS, {
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to get subscriptions';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subscription by ID' })
  @ApiResponse({
    status: 200,
    description: 'Subscription retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  getSubscriptionById(
    @Param('id') id: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.GET_SUBSCRIPTION, {
        id,
        userClaims,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to get subscription';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }
}
