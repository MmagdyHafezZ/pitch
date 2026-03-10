import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
} from '@nestjs/swagger';
import { GlobalJwtAuthGuard } from '../../guards/global-jwt-auth.guard';
import { UserClaimsInterceptor } from '../../interceptors/user-claims.interceptor';
import { UserClaims } from '../../decorators/user-claims.decorator';
import type { UserClaims as UserClaimsType } from '@pitch/shared-backend/interfaces/user-claims.interface';

/** Subset of the multer File shape needed by this controller. */
interface UploadedFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

/** Presigned URL is valid for 2 hours — long enough for the session. */
const PRESIGNED_URL_TTL_SECONDS = 7200;

@ApiTags('support')
@Controller({ path: 'support/attachments', version: '1' })
@UseGuards(GlobalJwtAuthGuard)
@UseInterceptors(UserClaimsInterceptor)
@ApiBearerAuth('bearer')
export class SupportAttachmentGatewayController {
  private readonly logger = new Logger(SupportAttachmentGatewayController.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.get<string>('STORAGE_BUCKET') ?? 'pitch-storage';
    const endpoint = config.get<string>('STORAGE_ENDPOINT');
    this.s3 = new S3Client({
      region: config.get<string>('STORAGE_REGION') ?? 'us-east-1',
      credentials: {
        accessKeyId: config.get<string>('STORAGE_ACCESS_KEY_ID') ?? '',
        secretAccessKey: config.get<string>('STORAGE_SECRET_ACCESS_KEY') ?? '',
      },
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });
  }

  /**
   * POST /v1/support/attachments/upload
   * Accepts a multipart file (max 10 MB), stores it in S3 under
   * coach-attachments/{userId}/{uuid}.{ext}, and returns a 2-hour presigned
   * download URL.  The caller passes this URL back in subsequent chat messages
   * so the LLM can fetch the document on demand via the fetch_document tool.
   */
  @Post('upload')
  @ApiOperation({
    summary: 'Upload a coach-chat attachment to S3 and get a presigned URL',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  async upload(
    @UploadedFile() file: UploadedFile,
    @UserClaims() userClaims: UserClaimsType,
  ): Promise<{ url: string; name: string; mimeType: string; size: number }> {
    if (!file) throw new BadRequestException('No file provided');

    const ext = file.originalname.includes('.')
      ? file.originalname.split('.').pop()!
      : 'bin';
    const key = `coach-attachments/${userClaims.id}/${randomUUID()}.${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: PRESIGNED_URL_TTL_SECONDS },
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
}
