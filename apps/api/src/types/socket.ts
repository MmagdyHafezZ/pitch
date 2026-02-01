export interface JwtTokenPayload {
  sub: string;
  email: string;
  name?: string;
  iat?: number;
  exp?: number;
}

export interface SocketUser {
  id: string;
  email: string;
  name?: string;
}
