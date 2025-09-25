import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserResponseDto } from '../dto/auth.dto';

export const CurrentUser = createParamDecorator(
  (
    data: keyof UserResponseDto | undefined,
    ctx: ExecutionContext,
  ): UserResponseDto | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
