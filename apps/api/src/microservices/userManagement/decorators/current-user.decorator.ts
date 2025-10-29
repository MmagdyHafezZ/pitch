import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

type RequestWithUser = Request & { user?: Record<string, unknown> };

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext): unknown => {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = req.user;

    if (!data) return user;
    if (user && typeof user === 'object' && data in user) {
      return (user as Record<string, unknown>)[data];
    }
    return undefined;
  },
);
