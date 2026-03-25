import { GradeService } from '../services/grade.service';
import type { LtiRepository } from '../repositories/lti.repository';

describe('GradeService', () => {
  const createRepositoryMock = (): jest.Mocked<LtiRepository> =>
    ({}) as unknown as jest.Mocked<LtiRepository>;

  it('returns success=true for a full grade payload', () => {
    const repository = createRepositoryMock();
    const service = new GradeService(repository);

    const result = service.syncGrade({
      userId: 'u1',
      lineItemId: 'li-1',
      score: 85,
      maxScore: 100,
      comment: 'Well done',
    });

    expect(result).toEqual({ success: true });
  });

  it('returns success=true when optional fields are omitted', () => {
    const repository = createRepositoryMock();
    const service = new GradeService(repository);

    const result = service.syncGrade({
      userId: 'u2',
      lineItemId: 'li-2',
      score: 50,
    });

    expect(result).toEqual({ success: true });
  });

  it('returns success=true for a zero score', () => {
    const repository = createRepositoryMock();
    const service = new GradeService(repository);

    const result = service.syncGrade({
      userId: 'u3',
      lineItemId: 'li-3',
      score: 0,
    });

    expect(result).toEqual({ success: true });
  });

  it('accepts extra arbitrary fields in the payload', () => {
    const repository = createRepositoryMock();
    const service = new GradeService(repository);

    const result = service.syncGrade({
      userId: 'u4',
      lineItemId: 'li-4',
      score: 70,
      extra: 'custom-field',
      nested: { foo: 'bar' },
    });

    expect(result).toEqual({ success: true });
  });

  it('is instantiatable (defined)', () => {
    const repository = createRepositoryMock();
    const service = new GradeService(repository);
    expect(service).toBeDefined();
  });
});
