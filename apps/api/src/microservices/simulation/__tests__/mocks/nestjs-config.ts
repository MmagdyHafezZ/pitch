export class ConfigService {
  get<T = any>(_key: string): T | undefined {
    void _key;
    return undefined;
  }
}

export const ConfigModule = {
  forRoot: () => ({ module: class ConfigModuleMock {} }),
};
