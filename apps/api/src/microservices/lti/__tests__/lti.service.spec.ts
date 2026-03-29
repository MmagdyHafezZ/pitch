import { LtiService } from '../services/lti.service';
import type { LtiRepository } from '../repositories/lti.repository';

describe('LtiService', () => {
  const createRepositoryMock = (): jest.Mocked<LtiRepository> =>
    ({}) as unknown as jest.Mocked<LtiRepository>;

  it('is instantiatable (defined)', () => {
    const repository = createRepositoryMock();
    const service = new LtiService(repository);
    expect(service).toBeDefined();
  });

  it('healthCheck returns status=healthy', () => {
    const repository = createRepositoryMock();
    const service = new LtiService(repository);

    const result = service.healthCheck();

    expect(result).toEqual({ status: 'healthy' });
  });

  it('healthCheck returns a plain object with a status key', () => {
    const repository = createRepositoryMock();
    const service = new LtiService(repository);

    const result = service.healthCheck();

    expect(result).toHaveProperty('status');
    expect(typeof result.status).toBe('string');
  });
});
