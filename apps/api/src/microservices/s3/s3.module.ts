import { Module } from '@nestjs/common';
import { S3Controller } from './controllers/s3.controller';
import { FileController } from './controllers/file.controller';
import { S3Service } from './services/s3.service';
import { FileService } from './services/file.service';
import { S3Repository } from './repositories/s3.repository';

@Module({
  controllers: [S3Controller, FileController],
  providers: [S3Service, FileService, S3Repository],
  exports: [S3Service],
})
export class S3Module {}