import { Inject, Injectable } from '@nestjs/common';
import { PhoneProvider } from './phone.provider';

@Injectable()
export class PhoneProviderFactory {
  constructor(
    @Inject('PHONE_PROVIDERS')
    private readonly providers: PhoneProvider[],
  ) {}

  getProvider(name?: string): PhoneProvider {
    if (!name) {
      return this.providers[0];
    }

    const provider = this.providers.find((p) => p.name === name);
    if (!provider) {
      throw new Error(`Phone provider "${name}" not registered`);
    }

    return provider;
  }

  listProviders() {
    return this.providers.map((provider) => ({
      name: provider.name,
      description: provider.description,
    }));
  }
}
