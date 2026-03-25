import { S3Service } from '../s3.service';
import type { S3Repository } from '../../repositories/s3.repository';

describe('S3Service', () => {
  const createRepositoryMock = (): jest.Mocked<S3Repository> =>
    ({
      createPresignedUploadUrl: jest.fn(),
      createPresignedDownloadUrl: jest.fn(),
      createPresignedDeleteUrl: jest.fn(),
      listFiles: jest.fn(),
      deleteByPrefix: jest.fn(),
    }) as unknown as jest.Mocked<S3Repository>;

  it('is instantiatable (defined)', () => {
    const repository = createRepositoryMock();
    const service = new S3Service(repository);
    expect(service).toBeDefined();
  });

  it('healthCheck returns status=healthy', () => {
    const repository = createRepositoryMock();
    const service = new S3Service(repository);

    const result = service.healthCheck();

    expect(result).toEqual({ status: 'healthy' });
  });

  it('healthCheck result has a string status field', () => {
    const repository = createRepositoryMock();
    const service = new S3Service(repository);

    const result = service.healthCheck();

    expect(typeof result.status).toBe('string');
  });

  it('healthCheck does not call any repository method', () => {
    const repository = createRepositoryMock();
    const service = new S3Service(repository);

    service.healthCheck();

    expect(repository.createPresignedUploadUrl).not.toHaveBeenCalled();
    expect(repository.createPresignedDownloadUrl).not.toHaveBeenCalled();
    expect(repository.createPresignedDeleteUrl).not.toHaveBeenCalled();
    expect(repository.listFiles).not.toHaveBeenCalled();
    expect(repository.deleteByPrefix).not.toHaveBeenCalled();
  });
});
