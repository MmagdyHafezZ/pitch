import { Injectable } from '@nestjs/common';

@Injectable()
export class S3Repository {
  // S3 repository handles file storage operations
  // No database needed - uses AWS S3 directly
}
