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
    const region = process.env.STORAGE_REGION;
    const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;

    if (!region) throw new Error('STORAGE_REGION is required');
    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        'STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY are required',
      );
    }

    this.defaultBucket = process.env.STORAGE_BUCKET;
    const endpoint = process.env.STORAGE_ENDPOINT;
    this.client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });
  }

  private resolveBucket(bucket?: string) {
    const resolved = bucket || this.defaultBucket;
    if (!resolved) throw new Error('STORAGE_BUCKET is required');
    return resolved;
  }

  async createPresignedUploadUrl(params: {
    bucket?: string;
    key: string;
    contentType?: string;
    expiresInSeconds?: number;
  }): Promise<{ url: string; bucket: string }> {
    const bucket = this.resolveBucket(params.bucket);
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: params.key,
      ContentType: params.contentType,
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: params.expiresInSeconds ?? this.defaultExpiresInSeconds,
    });

    return { url, bucket };
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
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const remainingLimit = params.limit
        ? params.limit - keys.length
        : undefined;
      if (remainingLimit !== undefined && remainingLimit <= 0) break;

      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: params.prefix,
        ContinuationToken: continuationToken,
        MaxKeys: remainingLimit ? Math.min(remainingLimit, 1000) : 1000,
      });

      const response = await this.client.send(command);
      const pageKeys =
        response.Contents?.map((item) => item.Key).filter(
          (key): key is string => Boolean(key),
        ) ?? [];
      keys.push(...pageKeys);
      continuationToken = response.IsTruncated
        ? response.NextContinuationToken
        : undefined;
    } while (continuationToken);

    return { keys };
  }

  async deleteByPrefix(params: {
    bucket: string;
    prefix: string;
  }): Promise<{ deleted: number }> {
    const bucket = this.resolveBucket(params.bucket);
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: params.prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });
      const listResponse = await this.client.send(listCommand);
      const pageKeys =
        listResponse.Contents?.map((item) => item.Key).filter(
          (key): key is string => Boolean(key),
        ) ?? [];
      keys.push(...pageKeys);
      continuationToken = listResponse.IsTruncated
        ? listResponse.NextContinuationToken
        : undefined;
    } while (continuationToken);

    if (keys.length === 0) return { deleted: 0 };

    let deletedCount = 0;
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000);
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: batch.map((key) => ({ Key: key })),
        },
      });
      const deleteResponse = await this.client.send(deleteCommand);
      deletedCount += deleteResponse.Deleted?.length ?? 0;
    }

    return { deleted: deletedCount };
  }
}
