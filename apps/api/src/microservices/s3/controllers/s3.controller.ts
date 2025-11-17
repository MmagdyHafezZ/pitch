import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { S3Service } from '../services/s3.service';

@Controller()
export class S3Controller {
  constructor(private readonly service: S3Service) {}

  @MessagePattern('s3.health')
  async healthCheck() {
    return { status: 'ok', service: 's3' };
  }
}
