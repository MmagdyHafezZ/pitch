import { S3Repository } from '../s3.repository';

const sendMock = jest.fn();
const getSignedUrlMock = jest.fn<Promise<string>, unknown[]>();

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => getSignedUrlMock(...args),
}));

jest.mock('@aws-sdk/client-s3', () => {
  class S3Client {
    constructor(public readonly config: unknown) {}
    send = sendMock;
  }

  const PutObjectCommand = jest.fn().mockImplementation((input) => ({
    input,
    name: 'PutObjectCommand',
  }));
  const GetObjectCommand = jest.fn().mockImplementation((input) => ({
    input,
    name: 'GetObjectCommand',
  }));
  const DeleteObjectCommand = jest.fn().mockImplementation((input) => ({
    input,
    name: 'DeleteObjectCommand',
  }));
  const ListObjectsV2Command = jest.fn().mockImplementation((input) => ({
    input,
    name: 'ListObjectsV2Command',
  }));
  const DeleteObjectsCommand = jest.fn().mockImplementation((input) => ({
    input,
    name: 'DeleteObjectsCommand',
  }));

  return {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    ListObjectsV2Command,
    DeleteObjectsCommand,
  };
});

describe('S3Repository', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      STORAGE_REGION: 'us-east-1',
      STORAGE_ACCESS_KEY_ID: 'test-access-key',
      STORAGE_SECRET_ACCESS_KEY: 'test-secret',
      STORAGE_BUCKET: 'test-bucket',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('creates a presigned upload URL', async () => {
    getSignedUrlMock.mockResolvedValueOnce('signed-upload-url');
    const repository = new S3Repository();

    const result = await repository.createPresignedUploadUrl({
      bucket: 'override-bucket',
      key: 'path/file.txt',
      contentType: 'text/plain',
      expiresInSeconds: 120,
    });

    expect(result).toEqual({ url: 'signed-upload-url' });
    expect(getSignedUrlMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        input: {
          Bucket: 'override-bucket',
          Key: 'path/file.txt',
          ContentType: 'text/plain',
        },
      }),
      { expiresIn: 120 },
    );
  });

  it('creates a presigned download URL', async () => {
    getSignedUrlMock.mockResolvedValueOnce('signed-download-url');
    const repository = new S3Repository();

    const result = await repository.createPresignedDownloadUrl({
      bucket: 'test-bucket',
      key: 'path/file.txt',
    });

    expect(result).toEqual({ url: 'signed-download-url' });
    expect(getSignedUrlMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        input: { Bucket: 'test-bucket', Key: 'path/file.txt' },
      }),
      { expiresIn: 900 },
    );
  });

  it('creates a presigned delete URL', async () => {
    getSignedUrlMock.mockResolvedValueOnce('signed-delete-url');
    const repository = new S3Repository();

    const result = await repository.createPresignedDeleteUrl({
      bucket: 'test-bucket',
      key: 'path/file.txt',
    });

    expect(result).toEqual({ url: 'signed-delete-url' });
    expect(getSignedUrlMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        input: { Bucket: 'test-bucket', Key: 'path/file.txt' },
      }),
      { expiresIn: 900 },
    );
  });

  it('lists files and filters empty keys', async () => {
    sendMock.mockResolvedValueOnce({
      Contents: [{ Key: 'a.txt' }, { Key: undefined }, {}],
    });
    const repository = new S3Repository();

    const result = await repository.listFiles({
      bucket: 'test-bucket',
      prefix: 'a/',
      limit: 5,
    });

    expect(result).toEqual({ keys: ['a.txt'] });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { Bucket: 'test-bucket', Prefix: 'a/', MaxKeys: 5 },
      }),
    );
  });

  it('deletes by prefix when objects exist', async () => {
    sendMock
      .mockResolvedValueOnce({ Contents: [{ Key: 'a.txt' }, { Key: 'b.txt' }] })
      .mockResolvedValueOnce({ Deleted: [{ Key: 'a.txt' }] });
    const repository = new S3Repository();

    const result = await repository.deleteByPrefix({
      bucket: 'test-bucket',
      prefix: 'a/',
    });

    expect(result).toEqual({ deleted: 1 });
    expect(sendMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: { Bucket: 'test-bucket', Prefix: 'a/' },
      }),
    );
    expect(sendMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        input: {
          Bucket: 'test-bucket',
          Delete: {
            Objects: [{ Key: 'a.txt' }, { Key: 'b.txt' }],
            Quiet: true,
          },
        },
      }),
    );
  });

  it('returns zero deletions when no objects match prefix', async () => {
    sendMock.mockResolvedValueOnce({ Contents: [] });
    const repository = new S3Repository();

    const result = await repository.deleteByPrefix({
      bucket: 'test-bucket',
      prefix: 'empty/',
    });

    expect(result).toEqual({ deleted: 0 });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('throws when required env vars are missing', () => {
    process.env = { ...process.env, STORAGE_REGION: '' };
    expect(() => new S3Repository()).toThrow('STORAGE_REGION is required');
  });
});

