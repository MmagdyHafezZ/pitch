import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  DeletePrefixDto,
  ListFilesDto,
  PresignDeleteDto,
  PresignDownloadDto,
  PresignUploadDto,
} from '../file.dto';

describe('S3 file DTOs', () => {
  it('validates presign upload required fields', async () => {
    const dto = plainToInstance(PresignUploadDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts a valid presign download payload', async () => {
    const dto = plainToInstance(PresignDownloadDto, {
      bucket: 'b',
      key: 'k',
      expiresInSeconds: 120,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid list limit', async () => {
    const dto = plainToInstance(ListFilesDto, {
      bucket: 'b',
      limit: 0,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts a valid delete prefix payload', async () => {
    const dto = plainToInstance(DeletePrefixDto, {
      bucket: 'b',
      prefix: 'p/',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid presign delete payload', async () => {
    const dto = plainToInstance(PresignDeleteDto, {
      bucket: 'b',
      key: 'k',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
