export interface ITokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}
export interface ITokenDataWithUser extends ITokenData {
  userId: string;
  userEmail: string;
  userName?: string;
  userAvatar?: string;
}
export interface ITokenDataWithProfile extends ITokenData {
  profile: {
    id: string;
    email: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    username?: string;
    locale?: string;
  };
}
