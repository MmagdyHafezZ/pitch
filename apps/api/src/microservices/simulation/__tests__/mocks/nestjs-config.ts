export class ConfigService {
  get<T = any>(_key: string): T | undefined {
    return undefined;
  }
}

export const ConfigModule = {
  forRoot: () => ({ module: class ConfigModuleMock {} }),
};
