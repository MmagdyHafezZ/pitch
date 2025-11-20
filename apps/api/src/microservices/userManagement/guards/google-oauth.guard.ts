import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

/**
 * Custom guard for Google OAuth that supports passing login_hint parameter
 * to pre-fill the user's email address in the Google sign-in flow
 */
@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const loginHint = request.query.login_hint;

    const options: Record<string, any> = {};

    if (loginHint && typeof loginHint === 'string') {
      options.login_hint = loginHint;
    }

    return options;
  }
}
