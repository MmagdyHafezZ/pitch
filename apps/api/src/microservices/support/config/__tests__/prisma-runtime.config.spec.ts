import { resolvePrismaRuntimeConfig } from '../prisma-runtime.config';

describe('support prisma-runtime.config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.DEP_MODE;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('prefers accelerateUrl by default', () => {
    const result = resolvePrismaRuntimeConfig(
      'prisma://accel',
      'postgresql://direct',
    );

    expect(result.url).toBe('prisma://accel');
    expect(result.useAccelerate).toBe(true);
  });

  it('uses directUrl in docker mode', () => {
    process.env.DEP_MODE = 'docker';

    const result = resolvePrismaRuntimeConfig(
      'prisma://accel',
      'postgresql://direct',
    );

    expect(result.url).toBe('postgresql://direct');
    expect(result.useAccelerate).toBe(false);
  });

  it('uses directUrl in local mode', () => {
    process.env.DEP_MODE = 'local';

    const result = resolvePrismaRuntimeConfig(
      'prisma://accel',
      'postgresql://direct',
    );

    expect(result.url).toBe('postgresql://direct');
  });

  it('returns undefined url when both are missing', () => {
    const result = resolvePrismaRuntimeConfig(undefined, undefined);

    expect(result.url).toBeUndefined();
    expect(result.useAccelerate).toBe(false);
  });

  it('detects prisma:// as accelerate URL', () => {
    const result = resolvePrismaRuntimeConfig('prisma://test');

    expect(result.useAccelerate).toBe(true);
  });

  it('detects prisma+ as accelerate URL', () => {
    const result = resolvePrismaRuntimeConfig('prisma+postgres://test');

    expect(result.useAccelerate).toBe(true);
  });

  it('does not treat regular postgres URLs as accelerate', () => {
    const result = resolvePrismaRuntimeConfig('postgresql://localhost/db');

    expect(result.useAccelerate).toBe(false);
  });
});
