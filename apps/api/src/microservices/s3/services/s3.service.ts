import { Injectable } from '@nestjs/common';
import { S3Repository } from '../repositories/s3.repository';

@Injectable()
export class S3Service {
  constructor(private readonly repository: S3Repository) {}

  healthCheck() {
    return { status: 'healthy' };
  }
}
