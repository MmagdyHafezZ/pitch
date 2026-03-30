import {
  Controller,
  Get,
  Post,
  Param,
  Inject,
  HttpException,
  HttpStatus,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, timeout } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { CheckSystemAdmin } from '../../guards/check-system-admin.guard';
import { UserClaimsInterceptor } from '../../interceptors/user-claims.interceptor';
import { UserClaims } from '../../decorators/user-claims.decorator';
import type { UserClaims as UserClaimsType } from '@pitch/shared-backend/interfaces/user-claims.interface';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';

@Controller({ path: 'admin/subscriptions', version: '1' })
@UseGuards(CheckSystemAdmin)
@UseInterceptors(UserClaimsInterceptor)
export class AdminSubscriptionsController {
  constructor(
    @Inject('USER_SERVICE') private readonly userService: ClientProxy,
  ) {}

  @Get('requests/plan-changes')
  listPendingPlanChanges(@UserClaims() userClaims?: UserClaimsType) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.LIST_PENDING_PLAN_CHANGES, { userClaims })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to list pending plan changes',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Post('requests/:id/approve-plan-change')
  approvePlanChange(
    @Param('id') id: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.APPROVE_PLAN_CHANGE, { id, userClaims })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to approve plan change',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Post('requests/:id/reject-plan-change')
  rejectPlanChange(
    @Param('id') id: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.userService
      .send(USER_SERVICE_PATTERNS.REJECT_PLAN_CHANGE, { id, userClaims })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to reject plan change',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }
}
