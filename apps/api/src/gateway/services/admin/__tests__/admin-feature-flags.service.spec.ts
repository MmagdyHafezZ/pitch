import { AdminFeatureFlagsService } from '../admin-feature-flags.service';

describe('AdminFeatureFlagsService', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  // ── constructor / initial state ───────────────────────────────────────────

  it('starts with an empty flags map when FEATURE_FLAGS is not set', () => {
    delete process.env.FEATURE_FLAGS;
    const service = new AdminFeatureFlagsService();
    expect(service.list()).toEqual([]);
  });

  it('parses FEATURE_FLAGS env var into the initial flags map', () => {
    process.env.FEATURE_FLAGS = 'featureA:true,featureB:false,featureC';
    const service = new AdminFeatureFlagsService();

    const flags = service.list();
    expect(flags).toContainEqual({ key: 'featureA', enabled: true });
    expect(flags).toContainEqual({ key: 'featureB', enabled: false });
    // No value after colon — treated as enabled (val !== 'false')
    expect(flags).toContainEqual({ key: 'featureC', enabled: true });
  });

  it('trims whitespace from flag keys and values', () => {
    process.env.FEATURE_FLAGS = '  myFlag : false  ';
    const service = new AdminFeatureFlagsService();
    expect(service.list()).toContainEqual({ key: 'myFlag', enabled: false });
  });

  it('ignores empty entries in FEATURE_FLAGS', () => {
    process.env.FEATURE_FLAGS = ',flagA:true,,';
    const service = new AdminFeatureFlagsService();
    const flags = service.list();
    expect(flags).toHaveLength(1);
    expect(flags[0]).toEqual({ key: 'flagA', enabled: true });
  });

  // ── list() ────────────────────────────────────────────────────────────────

  it('list() returns an empty array when no flags have been set', () => {
    delete process.env.FEATURE_FLAGS;
    const service = new AdminFeatureFlagsService();
    expect(service.list()).toEqual([]);
  });

  it('list() returns all flags after set() calls', () => {
    delete process.env.FEATURE_FLAGS;
    const service = new AdminFeatureFlagsService();
    service.set('alpha', true);
    service.set('beta', false);

    const flags = service.list();
    expect(flags).toHaveLength(2);
    expect(flags).toContainEqual({ key: 'alpha', enabled: true });
    expect(flags).toContainEqual({ key: 'beta', enabled: false });
  });

  // ── set() ─────────────────────────────────────────────────────────────────

  it('set() returns the updated flag entry', () => {
    delete process.env.FEATURE_FLAGS;
    const service = new AdminFeatureFlagsService();
    const result = service.set('newFlag', true);
    expect(result).toEqual({ key: 'newFlag', enabled: true });
  });

  it('set() overwrites an existing flag value', () => {
    delete process.env.FEATURE_FLAGS;
    const service = new AdminFeatureFlagsService();
    service.set('toggleMe', true);
    service.set('toggleMe', false);

    expect(service.list()).toContainEqual({ key: 'toggleMe', enabled: false });
  });

  it('set() adds a brand-new flag', () => {
    delete process.env.FEATURE_FLAGS;
    const service = new AdminFeatureFlagsService();
    service.set('brandNew', true);
    expect(service.list()).toEqual([{ key: 'brandNew', enabled: true }]);
  });

  // ── delete() ──────────────────────────────────────────────────────────────

  it('delete() returns true and removes the flag when it exists', () => {
    delete process.env.FEATURE_FLAGS;
    const service = new AdminFeatureFlagsService();
    service.set('toDelete', true);

    const result = service.delete('toDelete');

    expect(result).toBe(true);
    expect(service.list().find((f) => f.key === 'toDelete')).toBeUndefined();
  });

  it('delete() returns false when the flag does not exist', () => {
    delete process.env.FEATURE_FLAGS;
    const service = new AdminFeatureFlagsService();
    expect(service.delete('nonExistent')).toBe(false);
  });

  it('list() reflects deletions', () => {
    delete process.env.FEATURE_FLAGS;
    const service = new AdminFeatureFlagsService();
    service.set('a', true);
    service.set('b', false);
    service.delete('a');

    const flags = service.list();
    expect(flags).toHaveLength(1);
    expect(flags[0]).toEqual({ key: 'b', enabled: false });
  });
});
