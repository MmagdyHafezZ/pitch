import { Injectable } from '@nestjs/common';
import { S3Repository } from '../repositories/s3.repository';

@Injectable()
export class FileService {
  constructor(private readonly repository: S3Repository) {}

  async createPresignedUploadUrl(params: {
    bucket?: string;
    key: string;
    contentType?: string;
    expiresInSeconds?: number;
  }) {
    // Add input validation and any business rules.
    return this.repository.createPresignedUploadUrl(params);
  }

  async createPresignedDownloadUrl(params: {
    bucket: string;
    key: string;
    expiresInSeconds?: number;
  }) {
    // Add input validation and any business rules.
    return this.repository.createPresignedDownloadUrl(params);
  }

  async createPresignedDeleteUrl(params: {
    bucket: string;
    key: string;
    expiresInSeconds?: number;
  }) {
    // Add input validation and any business rules.
    return this.repository.createPresignedDeleteUrl(params);
  }

  async listFiles(params: { bucket: string; prefix?: string; limit?: number }) {
    // Add input validation and any business rules.
    return this.repository.listFiles(params);
  }

  async deleteByPrefix(params: { bucket: string; prefix: string }) {
    // Add input validation and any business rules.
    return this.repository.deleteByPrefix(params);
  }
}
