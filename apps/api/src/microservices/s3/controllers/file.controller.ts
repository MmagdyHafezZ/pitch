import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { S3_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import { FileService } from '../services/file.service';
import {
  DeletePrefixDto,
  ListFilesDto,
  PresignDeleteDto,
  PresignDownloadDto,
  PresignUploadDto,
} from '../dto/file.dto';

@Controller()
export class FileController {
  constructor(private readonly service: FileService) {}

  @MessagePattern(S3_SERVICE_PATTERNS.PRESIGN_UPLOAD)
  async presignUpload(
    @Payload()
    data: PresignUploadDto,
  ) {
    try {
      return await this.service.createPresignedUploadUrl(data);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(S3_SERVICE_PATTERNS.PRESIGN_DOWNLOAD)
  async presignDownload(
    @Payload()
    data: PresignDownloadDto,
  ) {
    try {
      return await this.service.createPresignedDownloadUrl(data);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(S3_SERVICE_PATTERNS.PRESIGN_DELETE)
  async presignDelete(
    @Payload()
    data: PresignDeleteDto,
  ) {
    try {
      return await this.service.createPresignedDeleteUrl(data);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(S3_SERVICE_PATTERNS.LIST_FILES)
  async listFiles(
    @Payload()
    data: ListFilesDto,
  ) {
    try {
      return await this.service.listFiles(data);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(S3_SERVICE_PATTERNS.DELETE_PREFIX)
  async deleteByPrefix(
    @Payload()
    data: DeletePrefixDto,
  ) {
    try {
      return await this.service.deleteByPrefix(data);
    } catch (error) {
      throw toRpcException(error);
    }
  }
}