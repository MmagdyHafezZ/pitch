import { S3GatewayController } from '../s3-gateway.controller';
import type { ClientProxy } from '@nestjs/microservices';
import { of, throwError, lastValueFrom } from 'rxjs';
import { HttpException } from '@nestjs/common';

describe('S3GatewayController', () => {
  const createClientProxyMock = (): jest.Mocked<ClientProxy> =>
    ({
      send: jest.fn(),
    }) as unknown as jest.Mocked<ClientProxy>;

  it('proxies presign upload', async () => {
    const client = createClientProxyMock();
    client.send.mockReturnValueOnce(of({ url: 'upload' }));
    const controller = new S3GatewayController(client);

    const result = await lastValueFrom(
      controller.presignUpload({ bucket: 'b', key: 'k' }),
    );

    expect(result).toEqual({ url: 'upload' });
    expect(client.send).toHaveBeenCalledWith('s3.presign.upload', {
      bucket: 'b',
      key: 'k',
    });
  });

  it('proxies list files with parsed limit', async () => {
    const client = createClientProxyMock();
    client.send.mockReturnValueOnce(of({ keys: [] }));
    const controller = new S3GatewayController(client);

    await lastValueFrom(controller.listFiles('b', 'p', '5'));

    expect(client.send).toHaveBeenCalledWith('s3.files.list', {
      bucket: 'b',
      prefix: 'p',
      limit: 5,
    });
  });

  it('maps errors to HttpException', async () => {
    const client = createClientProxyMock();
    client.send.mockReturnValueOnce(
      throwError(() => new Error('boom')),
    );
    const controller = new S3GatewayController(client);

    await expect(
      lastValueFrom(controller.presignDownload({ bucket: 'b', key: 'k' })),
    ).rejects.toThrow(HttpException);
  });
});
