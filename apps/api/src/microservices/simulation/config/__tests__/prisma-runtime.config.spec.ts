import { resolvePrismaRuntimeConfig } from '../prisma-runtime.config';

describe('resolvePrismaRuntimeConfig (simulation)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.DEP_MODE;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('prefers accelerateUrl over directUrl in non-docker mode', () => {
    const result = resolvePrismaRuntimeConfig(
      'prisma://accel',
      'postgresql://direct',
    );

    expect(result.url).toBe('prisma://accel');
    expect(result.useAccelerate).toBe(true);
  });

  it('falls back to directUrl when accelerateUrl is undefined', () => {
    const result = resolvePrismaRuntimeConfig(undefined, 'postgresql://direct');

    expect(result.url).toBe('postgresql://direct');
    expect(result.useAccelerate).toBe(false);
  });

  it('prefers directUrl in docker mode', () => {
    process.env.DEP_MODE = 'docker';

    const result = resolvePrismaRuntimeConfig(
      'prisma://accel',
      'postgresql://direct',
    );

    expect(result.url).toBe('postgresql://direct');
    expect(result.useAccelerate).toBe(false);
  });

  it('prefers directUrl in local mode', () => {
    process.env.DEP_MODE = 'local';

    const result = resolvePrismaRuntimeConfig(
      'prisma://accel',
      'postgresql://direct',
    );

    expect(result.url).toBe('postgresql://direct');
    expect(result.useAccelerate).toBe(false);
  });

  it('prefers directUrl in direct mode', () => {
    process.env.DEP_MODE = 'direct';

    const result = resolvePrismaRuntimeConfig(
      'prisma://accel',
      'postgresql://direct',
    );

    expect(result.url).toBe('postgresql://direct');
    expect(result.useAccelerate).toBe(false);
  });

  it('falls back to accelerateUrl in docker mode when directUrl is undefined', () => {
    process.env.DEP_MODE = 'docker';

    const result = resolvePrismaRuntimeConfig('prisma://accel', undefined);

    expect(result.url).toBe('prisma://accel');
    expect(result.useAccelerate).toBe(true);
  });

  it('detects accelerate URLs starting with prisma://', () => {
    const result = resolvePrismaRuntimeConfig('prisma://test');

    expect(result.useAccelerate).toBe(true);
  });

  it('detects accelerate URLs starting with prisma+', () => {
    const result = resolvePrismaRuntimeConfig('prisma+postgres://test');

    expect(result.useAccelerate).toBe(true);
  });

  it('returns useAccelerate false for normal postgres URLs', () => {
    const result = resolvePrismaRuntimeConfig('postgresql://localhost:5432/db');

    expect(result.useAccelerate).toBe(false);
  });

  it('returns undefined url when both are undefined', () => {
    const result = resolvePrismaRuntimeConfig(undefined, undefined);

    expect(result.url).toBeUndefined();
    expect(result.useAccelerate).toBe(false);
  });

  it('ignores unrecognized DEP_MODE values', () => {
    process.env.DEP_MODE = 'staging';

    const result = resolvePrismaRuntimeConfig(
      'prisma://accel',
      'postgresql://direct',
    );

    expect(result.url).toBe('prisma://accel');
  });
});
