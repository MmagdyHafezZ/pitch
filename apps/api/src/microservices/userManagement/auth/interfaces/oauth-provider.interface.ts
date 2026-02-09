import { AuthProvider } from '../factories/oauth-provider.factory';

export interface OAuthProfile {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  username?: string;
  locale?: string;
  provider: AuthProvider;
  providerData?: any;
}
