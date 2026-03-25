import { LaunchService } from '../services/launch.service';
import type { LtiRepository } from '../repositories/lti.repository';

describe('LaunchService', () => {
  const createRepositoryMock = (): jest.Mocked<LtiRepository> =>
    ({}) as unknown as jest.Mocked<LtiRepository>;

  it('returns success=true for a full launch payload', () => {
    const repository = createRepositoryMock();
    const service = new LaunchService(repository);

    const result = service.handleLaunch({
      platformId: 'platform-1',
      userId: 'user-1',
      courseId: 'course-42',
      resourceId: 'resource-7',
    });

    expect(result).toEqual({ success: true });
  });

  it('returns success=true when optional courseId and resourceId are omitted', () => {
    const repository = createRepositoryMock();
    const service = new LaunchService(repository);

    const result = service.handleLaunch({
      platformId: 'platform-2',
      userId: 'user-2',
    });

    expect(result).toEqual({ success: true });
  });

  it('accepts extra arbitrary fields in the payload', () => {
    const repository = createRepositoryMock();
    const service = new LaunchService(repository);

    const result = service.handleLaunch({
      platformId: 'platform-3',
      userId: 'user-3',
      customClaim: 'some-value',
    });

    expect(result).toEqual({ success: true });
  });

  it('is instantiatable (defined)', () => {
    const repository = createRepositoryMock();
    const service = new LaunchService(repository);
    expect(service).toBeDefined();
  });
});
