import {
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
  Query,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiQuery,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { GlobalJwtAuthGuard } from '../../guards/global-jwt-auth.guard';
import { UserClaimsInterceptor } from '../../interceptors/user-claims.interceptor';
import { UserClaims } from '../../decorators/user-claims.decorator';
import type { UserClaims as UserClaimsType } from '@pitch/shared-backend/interfaces/user-claims.interface';
import { Public } from '../../../microservices/userManagement/decorators/public.decorator';
import {
  SupportAttachmentStorageService,
  type SupportAttachmentUploadFile,
  SUPPORT_ATTACHMENT_TTL_SECONDS,
} from './support-attachment-storage.service';

@ApiTags('support')
@Controller({ path: 'support/attachments', version: '1' })
@UseGuards(GlobalJwtAuthGuard)
@UseInterceptors(UserClaimsInterceptor)
@ApiBearerAuth('bearer')
export class SupportAttachmentGatewayController {
  private readonly logger = new Logger(SupportAttachmentGatewayController.name);

  constructor(
    private readonly attachmentStorage: SupportAttachmentStorageService,
  ) {}

  /**
   * POST /v1/support/attachments/upload
   * Accepts a multipart file (max 10 MB), stores it in S3 under
   * coach-attachments/{userId}/{uuid}.{ext}, and returns a 2-hour signed
   * download URL.  The caller passes this URL back in subsequent chat messages
   * so the LLM can fetch the document on demand via the fetch_document tool.
   */
  @Post('upload')
  @ApiOperation({
    summary: 'Upload a coach-chat attachment and get a download URL',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  async upload(
    @UploadedFile() file: SupportAttachmentUploadFile,
    @UserClaims() userClaims: UserClaimsType,
  ): Promise<{ url: string; name: string; mimeType: string; size: number }> {
    if (!file) throw new BadRequestException('No file provided');
    this.attachmentStorage.assertUploadPermitted(file);

    const key = this.attachmentStorage.createObjectKey(
      userClaims.id,
      file.originalname,
    );

    await this.attachmentStorage.uploadToStorage(key, file);
    const url = this.attachmentStorage.createDownloadUrl(
      this.attachmentStorage.bucketName,
      key,
    );

    this.logger.log(
      `Coach attachment uploaded: key=${key} size=${file.size} user=${userClaims.id}`,
    );
    return {
      url,
      name: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  @Get('download')
  @Public()
  @ApiOperation({
    summary:
      'Download a previously uploaded coach-chat attachment by signed token',
  })
  @ApiQuery({ name: 'token', required: true })
  async download(
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!token) {
      throw new BadRequestException('Missing attachment token');
    }

    const { bucket, key } = this.attachmentStorage.parseDownloadToken(token);
    const { buffer, contentType } =
      await this.attachmentStorage.getObjectFromStorage(bucket, key);

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Cache-Control',
      `private, max-age=${SUPPORT_ATTACHMENT_TTL_SECONDS}`,
    );
    res.status(200).send(buffer);
  }
}
