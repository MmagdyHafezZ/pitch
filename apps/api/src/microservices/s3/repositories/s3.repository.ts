import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Repository {
  // S3 repository handles file storage operations
  // No database needed - uses AWS S3 directly
  private readonly client: S3Client;
  private readonly defaultBucket?: string;
  private readonly defaultExpiresInSeconds = 900;

  constructor() {
    const region = process.env.AWS_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!region) throw new Error('AWS_REGION is required');
    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required',
      );
    }

    this.defaultBucket = process.env.AWS_S3_BUCKET;
    const endpoint = process.env.AWS_ENDPOINT;
    this.client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });
  }

  private resolveBucket(bucket?: string) {
    const resolved = bucket || this.defaultBucket;
    if (!resolved) throw new Error('AWS_S3_BUCKET is required');
    return resolved;
  }

  async createPresignedUploadUrl(params: {
    bucket: string;
    key: string;
    contentType?: string;
    expiresInSeconds?: number;
  }): Promise<{ url: string }> {
    const bucket = this.resolveBucket(params.bucket);
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: params.key,
      ContentType: params.contentType,
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: params.expiresInSeconds ?? this.defaultExpiresInSeconds,
    });

    return { url };
  }

  async createPresignedDownloadUrl(params: {
    bucket: string;
    key: string;
    expiresInSeconds?: number;
  }): Promise<{ url: string }> {
    const bucket = this.resolveBucket(params.bucket);
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: params.key,
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: params.expiresInSeconds ?? this.defaultExpiresInSeconds,
    });

    return { url };
  }

  async createPresignedDeleteUrl(params: {
    bucket: string;
    key: string;
    expiresInSeconds?: number;
  }): Promise<{ url: string }> {
    const bucket = this.resolveBucket(params.bucket);
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: params.key,
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: params.expiresInSeconds ?? this.defaultExpiresInSeconds,
    });

    return { url };
  }

  async listFiles(params: {
    bucket: string;
    prefix?: string;
    limit?: number;
  }): Promise<{ keys: string[] }> {
    const bucket = this.resolveBucket(params.bucket);
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: params.prefix,
      MaxKeys: params.limit,
    });

    const response = await this.client.send(command);
    const keys =
      response.Contents?.map((item) => item.Key).filter((key): key is string =>
        Boolean(key),
      ) ?? [];

    return { keys };
  }

  async deleteByPrefix(params: {
    bucket: string;
    prefix: string;
  }): Promise<{ deleted: number }> {
    const bucket = this.resolveBucket(params.bucket);
    const listCommand = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: params.prefix,
    });

    const listResponse = await this.client.send(listCommand);
    const keys =
      listResponse.Contents?.map((item) => item.Key).filter(
        (key): key is string => Boolean(key),
      ) ?? [];

    if (keys.length === 0) return { deleted: 0 };

    const deleteCommand = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: keys.map((key) => ({ Key: key })),
        Quiet: true,
      },
    });

    const deleteResponse = await this.client.send(deleteCommand);
    const deletedCount = deleteResponse.Deleted?.length ?? 0;

    return { deleted: deletedCount };
  }
}
