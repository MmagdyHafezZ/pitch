import { S3Controller } from '../s3.controller';
import type { S3Service } from '../../services/s3.service';

describe('S3Controller', () => {
  const createServiceMock = (): jest.Mocked<S3Service> =>
    ({
      healthCheck: jest.fn(),
    }) as unknown as jest.Mocked<S3Service>;

  it('is instantiatable (defined)', () => {
    const service = createServiceMock();
    const controller = new S3Controller(service);
    expect(controller).toBeDefined();
  });

  it('healthCheck returns status=ok and service=s3', () => {
    const service = createServiceMock();
    const controller = new S3Controller(service);

    const result = controller.healthCheck();

    expect(result).toEqual({ status: 'ok', service: 's3' });
  });

  it('healthCheck returns result without calling the s3 service', () => {
    // The controller health method is self-contained and does not delegate
    // to the S3Service — this test confirms that contract.
    const service = createServiceMock();
    const controller = new S3Controller(service);

    controller.healthCheck();

    expect(service.healthCheck).not.toHaveBeenCalled();
  });

  it('healthCheck result has a string status', () => {
    const service = createServiceMock();
    const controller = new S3Controller(service);

    const result = controller.healthCheck();

    expect(typeof result.status).toBe('string');
    expect(typeof result.service).toBe('string');
  });
});
