import { applyDecorators, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CheckSystemAdmin } from '../guards/check-system-admin.guard';

export function SystemAdminOnly() {
  return applyDecorators(
    UseGuards(CheckSystemAdmin),
    ApiBearerAuth('bearer'),
    ApiUnauthorizedResponse({ description: 'Access token is required' }),
    ApiForbiddenResponse({
      description: 'System administrator access is required',
    }),
  );
}
