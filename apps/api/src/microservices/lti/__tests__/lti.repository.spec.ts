import { LtiRepository } from '../repositories/lti.repository';

describe('LtiRepository', () => {
  it('is instantiatable (defined)', () => {
    const repository = new LtiRepository();
    expect(repository).toBeDefined();
  });

  it('is an instance of LtiRepository', () => {
    const repository = new LtiRepository();
    expect(repository).toBeInstanceOf(LtiRepository);
  });

  it('has no own enumerable methods exposed', () => {
    // The repository intentionally delegates all persistence to the User
    // microservice — it has no database of its own.
    const repository = new LtiRepository();
    const ownMethods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(repository),
    ).filter((m) => m !== 'constructor');

    expect(ownMethods).toHaveLength(0);
  });
});
