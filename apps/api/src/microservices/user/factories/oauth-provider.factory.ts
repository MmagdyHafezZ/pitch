import { Injectable } from '@nestjs/common';

export enum AuthProvider {
  GOOGLE = 'GOOGLE',
  GITHUB = 'GITHUB',
  LINKEDIN = 'LINKEDIN',
  MICROSOFT = 'MICROSOFT',
  DISCORD = 'DISCORD',
}

export interface ProviderConfig {
  name: string;
  displayName: string;
  icon: string;
  color: string;
  enabled: boolean;
  scopes: string[];
  authUrl: string;
}

@Injectable()
export class OAuthProviderFactory {
  private providers: Map<AuthProvider, ProviderConfig> = new Map([
    [
      AuthProvider.GOOGLE,
      {
        name: 'google',
        displayName: 'Google',
        icon: '🔍',
        color: '#4285f4',
        enabled: true,
        scopes: ['email', 'profile'],
        authUrl: '/auth/oauth/google',
      },
    ],
    [
      AuthProvider.GITHUB,
      {
        name: 'github',
        displayName: 'GitHub',
        icon: '🐙',
        color: '#333333',
        enabled: true,
        scopes: ['user:email'],
        authUrl: '/auth/oauth/github',
      },
    ],
    [
      AuthProvider.LINKEDIN,
      {
        name: 'linkedin',
        displayName: 'LinkedIn',
        icon: '💼',
        color: '#0077B5',
        enabled: true,
        scopes: ['r_emailaddress', 'r_liteprofile'],
        authUrl: '/auth/oauth/linkedin',
      },
    ],
    [
      AuthProvider.MICROSOFT,
      {
        name: 'microsoft',
        displayName: 'Microsoft',
        icon: '🪟',
        color: '#00a4ef',
        enabled: true,
        scopes: ['User.Read'],
        authUrl: '/auth/oauth/microsoft',
      },
    ],
    [
      AuthProvider.DISCORD,
      {
        name: 'discord',
        displayName: 'Discord',
        icon: '🎮',
        color: '#7289DA',
        enabled: true,
        scopes: ['identify', 'email'],
        authUrl: '/auth/oauth/discord',
      },
    ],
  ]);

  getProvider(provider: AuthProvider): ProviderConfig | undefined {
    return this.providers.get(provider);
  }

  getEnabledProviders(): ProviderConfig[] {
    console.log('Fetching enabled OAuth providers');
    return Array.from(this.providers.values()).filter((p) => p.enabled);
  }

  getAllProviders(): ProviderConfig[] {
    return Array.from(this.providers.values());
  }
}
