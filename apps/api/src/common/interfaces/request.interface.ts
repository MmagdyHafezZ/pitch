import type { UserResponseDto } from '../../microservices/user/dto/auth.dto';

export interface RequestWithUser {
  user?: UserResponseDto;
}

export interface RequestWithUserClaims {
  userClaims?: {
    id: string;
    email: string;
    name: string;
  };
}

export interface RequestWithHeaders {
  url: string;
  method: string;
  headers: {
    authorization?: string;
  };
}

export interface RequestWithBody {
  body: Record<string, unknown>;
  method: string;
}
