import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { catchError, timeout } from 'rxjs/operators';
import { throwError } from 'rxjs';
import type { S3ServicePattern } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import {
  SupportAttachmentStorageService,
  type SupportAttachmentUploadFile,
} from '../support/support-attachment-storage.service';
const getErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof HttpException) return err.message;
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return fallback;
};

const getErrorStatus = (err: unknown): number => {
  if (err instanceof HttpException) return err.getStatus();
  return HttpStatus.INTERNAL_SERVER_ERROR;
};

const PRESIGN_UPLOAD: S3ServicePattern = 's3.presign.upload';
const PRESIGN_DOWNLOAD: S3ServicePattern = 's3.presign.download';
const PRESIGN_DELETE: S3ServicePattern = 's3.presign.delete';
const LIST_FILES: S3ServicePattern = 's3.files.list';
const DELETE_PREFIX: S3ServicePattern = 's3.files.deletePrefix';

@ApiTags('s3')
@ApiBearerAuth('bearer')
@Controller({ path: 's3', version: '1' })
export class S3GatewayController {
  constructor(
    @Inject('S3_SERVICE') private s3Service: ClientProxy,
    private readonly attachmentStorage: SupportAttachmentStorageService,
  ) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a file to the configured storage bucket' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: SupportAttachmentUploadFile,
    @Body('key') key: string | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    this.attachmentStorage.assertUploadPermitted(file);

    const resolvedKey = key?.trim();
    if (!resolvedKey) {
      throw new BadRequestException('Key is required');
    }

    await this.attachmentStorage.uploadToStorage(resolvedKey, file);
    const textPreview = await this.attachmentStorage.extractTextPreview(file);

    return {
      bucket: this.attachmentStorage.bucketName,
      key: resolvedKey,
      filename: file.originalname,
      contentType: file.mimetype || 'application/octet-stream',
      size: file.size,
      uploadedAt: new Date().toISOString(),
      textPreview,
    };
  }

  @Post('presigned/upload')
  @ApiOperation({ summary: 'Get a presigned upload URL' })
  @ApiResponse({ status: 200, description: 'Presigned upload URL generated' })
  presignUpload(
    @Body()
    body: {
      bucket?: string;
      key: string;
      contentType?: string;
      expiresInSeconds?: number;
    },
  ) {
    return this.s3Service.send(PRESIGN_UPLOAD, body).pipe(
      timeout(5000),
      catchError((err: unknown) => {
        const message = getErrorMessage(
          err,
          'Failed to generate presigned upload URL',
        );
        const status = getErrorStatus(err);
        return throwError(() => new HttpException(message, status));
      }),
    );
  }

  @Post('presigned/download')
  @ApiOperation({ summary: 'Get a presigned download URL' })
  @ApiResponse({ status: 200, description: 'Presigned download URL generated' })
  presignDownload(
    @Body()
    body: {
      bucket: string;
      key: string;
      expiresInSeconds?: number;
    },
  ) {
    return this.s3Service.send(PRESIGN_DOWNLOAD, body).pipe(
      timeout(5000),
      catchError((err: unknown) => {
        const message = getErrorMessage(
          err,
          'Failed to generate presigned download URL',
        );
        const status = getErrorStatus(err);
        return throwError(() => new HttpException(message, status));
      }),
    );
  }

  @Post('presigned/delete')
  @ApiOperation({ summary: 'Get a presigned delete URL' })
  @ApiResponse({ status: 200, description: 'Presigned delete URL generated' })
  presignDelete(
    @Body()
    body: {
      bucket: string;
      key: string;
      expiresInSeconds?: number;
    },
  ) {
    return this.s3Service.send(PRESIGN_DELETE, body).pipe(
      timeout(5000),
      catchError((err: unknown) => {
        const message = getErrorMessage(
          err,
          'Failed to generate presigned delete URL',
        );
        const status = getErrorStatus(err);
        return throwError(() => new HttpException(message, status));
      }),
    );
  }

  @Get('files')
  @ApiOperation({ summary: 'List files by prefix' })
  @ApiResponse({ status: 200, description: 'Files listed successfully' })
  listFiles(
    @Query('bucket') bucket: string,
    @Query('prefix') prefix?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.s3Service
      .send(LIST_FILES, {
        bucket,
        prefix,
        limit: parsedLimit,
      })
      .pipe(
        timeout(5000),
        catchError((err: unknown) => {
          const message = getErrorMessage(err, 'Failed to list files');
          const status = getErrorStatus(err);
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Delete('prefix')
  @ApiOperation({ summary: 'Delete files by prefix' })
  @ApiResponse({ status: 200, description: 'Files deleted successfully' })
  deleteByPrefix(
    @Query('bucket') bucket: string,
    @Query('prefix') prefix: string,
  ) {
    return this.s3Service.send(DELETE_PREFIX, { bucket, prefix }).pipe(
      timeout(5000),
      catchError((err: unknown) => {
        const message = getErrorMessage(
          err,
          'Failed to delete files by prefix',
        );
        const status = getErrorStatus(err);
        return throwError(() => new HttpException(message, status));
      }),
    );
  }
}
