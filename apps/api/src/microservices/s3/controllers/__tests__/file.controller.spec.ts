import { FileController } from '../file.controller';
import type { FileService } from '../../services/file.service';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import { RpcException } from '@nestjs/microservices';

jest.mock('@pitch/shared-backend/helpers/exceptions', () => ({
  toRpcException: jest.fn((error: unknown) => error),
}));

describe('FileController', () => {
  const createServiceMock = (): jest.Mocked<FileService> =>
    ({
      createPresignedUploadUrl: jest.fn(),
      createPresignedDownloadUrl: jest.fn(),
      createPresignedDeleteUrl: jest.fn(),
      listFiles: jest.fn(),
      deleteByPrefix: jest.fn(),
    }) as unknown as jest.Mocked<FileService>;

  const toRpcExceptionMock = jest.mocked(toRpcException);

  beforeEach(() => {
    jest.clearAllMocks();
    toRpcExceptionMock.mockReset();
  });

  it('handles presign upload', async () => {
    const service = createServiceMock();
    service.createPresignedUploadUrl.mockResolvedValue({ url: 'upload' });
    const controller = new FileController(service);

    await expect(
      controller.presignUpload({ bucket: 'b', key: 'k' }),
    ).resolves.toEqual({ url: 'upload' });
    expect(service.createPresignedUploadUrl).toHaveBeenCalledWith({
      bucket: 'b',
      key: 'k',
    });
  });

  it('handles presign download', async () => {
    const service = createServiceMock();
    service.createPresignedDownloadUrl.mockResolvedValue({ url: 'download' });
    const controller = new FileController(service);

    await expect(
      controller.presignDownload({ bucket: 'b', key: 'k' }),
    ).resolves.toEqual({ url: 'download' });
  });

  it('handles presign delete', async () => {
    const service = createServiceMock();
    service.createPresignedDeleteUrl.mockResolvedValue({ url: 'delete' });
    const controller = new FileController(service);

    await expect(
      controller.presignDelete({ bucket: 'b', key: 'k' }),
    ).resolves.toEqual({ url: 'delete' });
  });

  it('handles list files', async () => {
    const service = createServiceMock();
    service.listFiles.mockResolvedValue({ keys: ['a'] });
    const controller = new FileController(service);

    await expect(
      controller.listFiles({ bucket: 'b', prefix: 'p', limit: 1 }),
    ).resolves.toEqual({ keys: ['a'] });
  });

  it('handles delete by prefix', async () => {
    const service = createServiceMock();
    service.deleteByPrefix.mockResolvedValue({ deleted: 2 });
    const controller = new FileController(service);

    await expect(
      controller.deleteByPrefix({ bucket: 'b', prefix: 'p' }),
    ).resolves.toEqual({ deleted: 2 });
  });

  it('wraps errors with toRpcException', async () => {
    const service = createServiceMock();
    const error = new Error('failure');
    const rpcError = new RpcException('rpc');
    service.createPresignedUploadUrl.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError);
    const controller = new FileController(service);

    await expect(
      controller.presignUpload({ bucket: 'b', key: 'k' }),
    ).rejects.toThrow(rpcError);
  });
});
