import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserResponseDto } from '../dto/auth.dto';
import type { RequestWithUser } from '../../../common/interfaces/request.interface';

export const currentUserFactory = (
  data: keyof UserResponseDto | undefined,
  ctx: ExecutionContext,
): UserResponseDto | string | undefined => {
  const request = ctx.switchToHttp().getRequest<RequestWithUser>();
  const user = request.user;

  if (data && user) {
    const value = user[data];
    return typeof value === 'string' ? value : undefined;
  }
  return user;
};

export const CurrentUser = createParamDecorator(currentUserFactory);
