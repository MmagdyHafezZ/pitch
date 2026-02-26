import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';

export interface JwtUser {
  id: string;
  email?: string;
  [key: string]: unknown;
}

const isJwtUser = (user: unknown): user is JwtUser => {
  return Boolean(
    user &&
      typeof user === 'object' &&
      typeof (user as { id?: unknown }).id === 'string',
  );
};

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly jwtService: JwtService) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest<TUser = JwtUser>(
    err: unknown,
    user: unknown,
    ..._args: unknown[]
  ): TUser {
    void _args;
    if (err) {
      if (err instanceof Error) {
        throw err;
      }
      throw new UnauthorizedException('Authentication error');
    }
    if (!isJwtUser(user)) {
      throw new UnauthorizedException('Invalid token');
    }
    return user as TUser;
  }
}
