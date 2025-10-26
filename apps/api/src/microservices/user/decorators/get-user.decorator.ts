import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

type RequestWithUser = Request & { user?: Record<string, unknown> };

export const GetUser = createParamDecorator(
  (
    _data: unknown,
    ctx: ExecutionContext,
  ): Record<string, unknown> | undefined => {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = req.user;
    return typeof user === 'object'
      ? (user as Record<string, unknown>)
      : undefined;
  },
);
