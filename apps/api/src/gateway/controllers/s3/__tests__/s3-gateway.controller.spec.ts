import { S3GatewayController } from '../s3-gateway.controller';
import type { ClientProxy } from '@nestjs/microservices';
import { of, throwError, lastValueFrom } from 'rxjs';
import { BadRequestException, HttpException } from '@nestjs/common';
import type { SupportAttachmentStorageService } from '../../support/support-attachment-storage.service';

describe('S3GatewayController', () => {
  const createClientProxyMock = (): jest.Mocked<ClientProxy> =>
    ({
      send: jest.fn(),
    }) as unknown as jest.Mocked<ClientProxy>;

  const createAttachmentStorageMock =
    (): jest.Mocked<SupportAttachmentStorageService> =>
      ({
        bucketName: 'test-bucket',
        assertUploadPermitted: jest.fn(),
        uploadToStorage: jest.fn(),
        extractTextPreview: jest.fn(),
      }) as unknown as jest.Mocked<SupportAttachmentStorageService>;

  it('proxies presign upload', async () => {
    const client = createClientProxyMock();
    const attachmentStorage = createAttachmentStorageMock();
    client.send.mockReturnValueOnce(
      of({ url: 'upload', bucket: 'resolved-bucket' }),
    );
    const controller = new S3GatewayController(client, attachmentStorage);

    const result = await lastValueFrom(controller.presignUpload({ key: 'k' }));

    expect(result).toEqual({ url: 'upload', bucket: 'resolved-bucket' });
    expect(client.send).toHaveBeenCalledWith('s3.presign.upload', {
      key: 'k',
    });
  });

  it('proxies presign download', async () => {
    const client = createClientProxyMock();
    const attachmentStorage = createAttachmentStorageMock();
    client.send.mockReturnValueOnce(of({ url: 'download' }));
    const controller = new S3GatewayController(client, attachmentStorage);

    const result = await lastValueFrom(
      controller.presignDownload({ bucket: 'b', key: 'k' }),
    );

    expect(result).toEqual({ url: 'download' });
    expect(client.send).toHaveBeenCalledWith('s3.presign.download', {
      bucket: 'b',
      key: 'k',
    });
  });

  it('proxies presign delete', async () => {
    const client = createClientProxyMock();
    const attachmentStorage = createAttachmentStorageMock();
    client.send.mockReturnValueOnce(of({ url: 'delete' }));
    const controller = new S3GatewayController(client, attachmentStorage);

    const result = await lastValueFrom(
      controller.presignDelete({ bucket: 'b', key: 'k' }),
    );

    expect(result).toEqual({ url: 'delete' });
    expect(client.send).toHaveBeenCalledWith('s3.presign.delete', {
      bucket: 'b',
      key: 'k',
    });
  });

  it('proxies list files with parsed limit', async () => {
    const client = createClientProxyMock();
    const attachmentStorage = createAttachmentStorageMock();
    client.send.mockReturnValueOnce(of({ keys: [] }));
    const controller = new S3GatewayController(client, attachmentStorage);

    await lastValueFrom(controller.listFiles('b', 'p', '5'));

    expect(client.send).toHaveBeenCalledWith('s3.files.list', {
      bucket: 'b',
      prefix: 'p',
      limit: 5,
    });
  });

  it('proxies delete by prefix', async () => {
    const client = createClientProxyMock();
    const attachmentStorage = createAttachmentStorageMock();
    client.send.mockReturnValueOnce(of({ deleted: 2 }));
    const controller = new S3GatewayController(client, attachmentStorage);

    const result = await lastValueFrom(controller.deleteByPrefix('b', 'p'));

    expect(result).toEqual({ deleted: 2 });
    expect(client.send).toHaveBeenCalledWith('s3.files.deletePrefix', {
      bucket: 'b',
      prefix: 'p',
    });
  });

  it('maps errors to HttpException', async () => {
    const client = createClientProxyMock();
    const attachmentStorage = createAttachmentStorageMock();
    client.send.mockReturnValueOnce(throwError(() => new Error('boom')));
    const controller = new S3GatewayController(client, attachmentStorage);

    await expect(
      lastValueFrom(controller.presignDownload({ bucket: 'b', key: 'k' })),
    ).rejects.toThrow(HttpException);
  });

  it('uploads files through the gateway', async () => {
    const client = createClientProxyMock();
    const attachmentStorage = createAttachmentStorageMock();
    const controller = new S3GatewayController(client, attachmentStorage);
    const file = {
      originalname: 'proposal.pdf',
      mimetype: 'application/pdf',
      size: 123,
      buffer: Buffer.from('file'),
    };
    attachmentStorage.extractTextPreview.mockResolvedValueOnce(
      'Customer requirements: SSO, audit logs, and a 30-day rollout.',
    );

    const result = await controller.upload(
      file,
      'sessions/session-1/proposal.pdf',
    );

    expect(attachmentStorage.assertUploadPermitted).toHaveBeenCalledWith(file);
    expect(attachmentStorage.uploadToStorage).toHaveBeenCalledWith(
      'sessions/session-1/proposal.pdf',
      file,
    );
    expect(result).toEqual(
      expect.objectContaining({
        bucket: 'test-bucket',
        key: 'sessions/session-1/proposal.pdf',
        filename: 'proposal.pdf',
        contentType: 'application/pdf',
        size: 123,
        textPreview:
          'Customer requirements: SSO, audit logs, and a 30-day rollout.',
      }),
    );
  });

  it('rejects uploads without a key', async () => {
    const client = createClientProxyMock();
    const attachmentStorage = createAttachmentStorageMock();
    const controller = new S3GatewayController(client, attachmentStorage);

    await expect(
      controller.upload(
        {
          originalname: 'proposal.pdf',
          mimetype: 'application/pdf',
          size: 123,
          buffer: Buffer.from('file'),
        },
        '   ',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects unsupported uploads before storing', async () => {
    const client = createClientProxyMock();
    const attachmentStorage = createAttachmentStorageMock();
    attachmentStorage.assertUploadPermitted.mockImplementation(() => {
      throw new BadRequestException('Unsupported file type.');
    });
    const controller = new S3GatewayController(client, attachmentStorage);

    await expect(
      controller.upload(
        {
          originalname: 'archive.zip',
          mimetype: 'application/zip',
          size: 123,
          buffer: Buffer.from('file'),
        },
        'sessions/session-1/archive.zip',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(attachmentStorage.uploadToStorage).not.toHaveBeenCalled();
  });
});
