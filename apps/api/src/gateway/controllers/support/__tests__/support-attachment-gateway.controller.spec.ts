import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SupportAttachmentGatewayController } from '../support-attachment-gateway.controller';

// ── mock AWS SDK ──────────────────────────────────────────────────────────────

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://presigned.url/key'),
}));

jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('mocked-uuid'),
}));

// ── helpers ──────────────────────────────────────────────────────────────────

const makeConfigService = (
  overrides: Record<string, string> = {},
): ConfigService => {
  const defaults: Record<string, string> = {
    STORAGE_BUCKET: 'test-bucket',
    STORAGE_REGION: 'us-east-1',
    STORAGE_ACCESS_KEY_ID: 'key-id',
    STORAGE_SECRET_ACCESS_KEY: 'secret',
    ...overrides,
  };
  return {
    get: jest.fn((key: string) => defaults[key]),
  } as unknown as ConfigService;
};

const makeFile = (
  overrides: Partial<{
    fieldname: string;
    originalname: string;
    mimetype: string;
    buffer: Buffer;
    size: number;
  }> = {},
) => ({
  fieldname: 'file',
  originalname: 'test.pdf',
  mimetype: 'application/pdf',
  buffer: Buffer.from('file content'),
  size: 1024,
  ...overrides,
});

const userClaims = { id: 'u1', email: 'u@x.com', name: 'User' };

// ── tests ─────────────────────────────────────────────────────────────────────

describe('SupportAttachmentGatewayController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-mock S3Client send after clearAllMocks
    (S3Client as jest.Mock).mockImplementation(() => ({
      send: jest.fn().mockResolvedValue({}),
    }));
    (getSignedUrl as jest.Mock).mockResolvedValue('https://presigned.url/key');
  });

  it('throws BadRequestException when no file is provided', async () => {
    const ctrl = new SupportAttachmentGatewayController(makeConfigService());
    await expect(ctrl.upload(undefined as any, userClaims)).rejects.toThrow(
      BadRequestException,
    );
    await expect(ctrl.upload(undefined as any, userClaims)).rejects.toThrow(
      'No file provided',
    );
  });

  it('uploads the file to S3 with the correct key and content type', async () => {
    const config = makeConfigService();
    const ctrl = new SupportAttachmentGatewayController(config);
    const file = makeFile();

    await ctrl.upload(file as any, userClaims);

    const putArgs = (PutObjectCommand as jest.Mock).mock.calls[0][0];
    expect(putArgs.Bucket).toBe('test-bucket');
    expect(putArgs.Key).toBe(
      `coach-attachments/${userClaims.id}/mocked-uuid.pdf`,
    );
    expect(putArgs.ContentType).toBe('application/pdf');
    expect(putArgs.Body).toEqual(file.buffer);
  });

  it('generates a presigned download URL after upload', async () => {
    const ctrl = new SupportAttachmentGatewayController(makeConfigService());
    const file = makeFile();

    await ctrl.upload(file as any, userClaims);

    const getArgs = (GetObjectCommand as jest.Mock).mock.calls[0][0];
    expect(getArgs.Bucket).toBe('test-bucket');
    expect(getArgs.Key).toContain('coach-attachments/u1/');
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 7200 },
    );
  });

  it('returns url, name, mimeType and size in the response', async () => {
    const ctrl = new SupportAttachmentGatewayController(makeConfigService());
    const file = makeFile({
      originalname: 'report.pdf',
      mimetype: 'application/pdf',
      size: 2048,
    });

    const result = await ctrl.upload(file as any, userClaims);

    expect(result.url).toBe('https://presigned.url/key');
    expect(result.name).toBe('report.pdf');
    expect(result.mimeType).toBe('application/pdf');
    expect(result.size).toBe(2048);
  });

  it('derives the file extension from the original filename', async () => {
    const ctrl = new SupportAttachmentGatewayController(makeConfigService());
    const file = makeFile({
      originalname: 'image.jpg',
      mimetype: 'image/jpeg',
    });

    await ctrl.upload(file as any, userClaims);

    const putArgs = (PutObjectCommand as jest.Mock).mock.calls[0][0];
    expect(putArgs.Key).toMatch(/\.jpg$/);
  });

  it('falls back to "bin" extension when filename has no extension', async () => {
    const ctrl = new SupportAttachmentGatewayController(makeConfigService());
    const file = makeFile({
      originalname: 'noextension',
      mimetype: 'application/octet-stream',
    });

    await ctrl.upload(file as any, userClaims);

    const putArgs = (PutObjectCommand as jest.Mock).mock.calls[0][0];
    expect(putArgs.Key).toMatch(/\.bin$/);
  });

  it('uses the default bucket name when STORAGE_BUCKET is not configured', async () => {
    const config = makeConfigService({ STORAGE_BUCKET: '' });
    // ConfigService.get returns '' which is falsy → should use 'pitch-storage'
    (config.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'STORAGE_BUCKET') return undefined;
      return 'value';
    });
    const ctrl = new SupportAttachmentGatewayController(config);
    const file = makeFile();

    await ctrl.upload(file as any, userClaims);

    const putArgs = (PutObjectCommand as jest.Mock).mock.calls[0][0];
    expect(putArgs.Bucket).toBe('pitch-storage');
  });

  it('reads config values in the constructor to build the S3 client', () => {
    const config = makeConfigService({
      STORAGE_REGION: 'eu-west-1',
      STORAGE_ACCESS_KEY_ID: 'my-key',
      STORAGE_SECRET_ACCESS_KEY: 'my-secret',
    });
    new SupportAttachmentGatewayController(config);

    const s3CtorArgs = (S3Client as jest.Mock).mock.calls[0][0];
    expect(s3CtorArgs.region).toBe('eu-west-1');
    expect(s3CtorArgs.credentials.accessKeyId).toBe('my-key');
    expect(s3CtorArgs.credentials.secretAccessKey).toBe('my-secret');
  });
});
