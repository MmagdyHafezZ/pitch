import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { S3Service } from '../services/s3.service';

@Controller()
export class S3Controller {
  constructor(private readonly service: S3Service) {}

  @MessagePattern('s3.health')
  healthCheck() {
    return { status: 'ok', service: 's3' };
  }
}
