import { FileService } from '../file.service';
import type { S3Repository } from '../../repositories/s3.repository';

describe('FileService', () => {
  const createRepositoryMock = (): jest.Mocked<S3Repository> =>
    ({
      createPresignedUploadUrl: jest.fn(),
      createPresignedDownloadUrl: jest.fn(),
      createPresignedDeleteUrl: jest.fn(),
      listFiles: jest.fn(),
      deleteByPrefix: jest.fn(),
    }) as unknown as jest.Mocked<S3Repository>;

  it('delegates presign upload to repository', async () => {
    const repository = createRepositoryMock();
    repository.createPresignedUploadUrl.mockResolvedValue({ url: 'upload' });
    const service = new FileService(repository);

    const result = await service.createPresignedUploadUrl({
      bucket: 'b',
      key: 'k',
    });

    expect(result).toEqual({ url: 'upload' });
    expect(repository.createPresignedUploadUrl).toHaveBeenCalledWith({
      bucket: 'b',
      key: 'k',
    });
  });

  it('delegates presign download to repository', async () => {
    const repository = createRepositoryMock();
    repository.createPresignedDownloadUrl.mockResolvedValue({ url: 'download' });
    const service = new FileService(repository);

    const result = await service.createPresignedDownloadUrl({
      bucket: 'b',
      key: 'k',
    });

    expect(result).toEqual({ url: 'download' });
    expect(repository.createPresignedDownloadUrl).toHaveBeenCalledWith({
      bucket: 'b',
      key: 'k',
    });
  });

  it('delegates presign delete to repository', async () => {
    const repository = createRepositoryMock();
    repository.createPresignedDeleteUrl.mockResolvedValue({ url: 'delete' });
    const service = new FileService(repository);

    const result = await service.createPresignedDeleteUrl({
      bucket: 'b',
      key: 'k',
    });

    expect(result).toEqual({ url: 'delete' });
    expect(repository.createPresignedDeleteUrl).toHaveBeenCalledWith({
      bucket: 'b',
      key: 'k',
    });
  });

  it('delegates list files to repository', async () => {
    const repository = createRepositoryMock();
    repository.listFiles.mockResolvedValue({ keys: ['a'] });
    const service = new FileService(repository);

    const result = await service.listFiles({ bucket: 'b', prefix: 'p' });

    expect(result).toEqual({ keys: ['a'] });
    expect(repository.listFiles).toHaveBeenCalledWith({
      bucket: 'b',
      prefix: 'p',
    });
  });

  it('delegates delete by prefix to repository', async () => {
    const repository = createRepositoryMock();
    repository.deleteByPrefix.mockResolvedValue({ deleted: 1 });
    const service = new FileService(repository);

    const result = await service.deleteByPrefix({ bucket: 'b', prefix: 'p' });

    expect(result).toEqual({ deleted: 1 });
    expect(repository.deleteByPrefix).toHaveBeenCalledWith({
      bucket: 'b',
      prefix: 'p',
    });
  });
});
