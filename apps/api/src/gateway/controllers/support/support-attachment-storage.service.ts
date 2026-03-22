import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import axios from 'axios';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import JSZip from 'jszip';

export interface SupportAttachmentUploadFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export type AttachmentDownloadTokenPayload = {
  bucket: string;
  key: string;
  expiresAt: number;
};

type StorageMode = 'aws-s3' | 'ibm-cos-iam';

type IbmIamTokenResponse = {
  access_token: string;
  expiration?: number;
  expires_in?: number;
};

export const SUPPORT_ATTACHMENT_TTL_SECONDS = 7200;
const IBM_IAM_TOKEN_URL = 'https://iam.cloud.ibm.com/oidc/token';
const ATTACHMENT_TEXT_PREVIEW_LIMIT = 2000;
const BLOCKED_ATTACHMENT_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.ps1',
  '.js',
  '.html',
  '.svg',
  '.sh',
  '.msi',
  '.dll',
]);
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.tsv',
  '.ppt',
  '.pptx',
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.xml',
  '.rtf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
]);
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/tab-separated-values',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'application/json',
  'application/xml',
  'text/xml',
  'application/rtf',
  'text/rtf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);
const ALLOWED_ATTACHMENT_TYPES_TEXT =
  'PDF (.pdf), Word (.doc, .docx), Excel (.xls, .xlsx, .csv, .tsv), PowerPoint (.ppt, .pptx), text (.txt, .md, .json, .xml, .rtf), and images (.png, .jpg, .jpeg, .webp)';
const TEXT_PREVIEW_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.tsv',
  '.json',
  '.xml',
  '.rtf',
]);
const DOCX_CONTENT_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const XLSX_CONTENT_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const PPTX_CONTENT_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

@Injectable()
export class SupportAttachmentStorageService {
  private readonly logger = new Logger(SupportAttachmentStorageService.name);
  private readonly s3?: S3Client;
  private readonly bucket: string;
  private readonly endpoint?: string;
  private readonly apiBaseUrl: string;
  private readonly storageMode: StorageMode;
  private readonly ibmApiKey?: string;
  private readonly downloadSigningSecret: string;
  private ibmAccessToken:
    | {
        value: string;
        expiresAt: number;
      }
    | undefined;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.get<string>('STORAGE_BUCKET') ?? 'pitch-storage';
    this.endpoint = config.get<string>('STORAGE_ENDPOINT')?.trim() || undefined;
    this.apiBaseUrl =
      config.get<string>('API_BASE_URL')?.replace(/\/+$/, '') ||
      'http://localhost:8000';
    this.downloadSigningSecret =
      config.get<string>('JWT_SECRET') ||
      config.get<string>('STORAGE_SECRET_ACCESS_KEY') ||
      'support-attachment-dev-secret';

    if (this.isIbmCosIamConfig()) {
      this.storageMode = 'ibm-cos-iam';
      this.ibmApiKey =
        config.get<string>('IBM_COS_API_KEY') ||
        config.get<string>('STORAGE_SECRET_ACCESS_KEY') ||
        '';
      return;
    }

    this.storageMode = 'aws-s3';
    this.s3 = new S3Client({
      region: config.get<string>('STORAGE_REGION') ?? 'us-east-1',
      credentials: {
        accessKeyId: config.get<string>('STORAGE_ACCESS_KEY_ID') ?? '',
        secretAccessKey: config.get<string>('STORAGE_SECRET_ACCESS_KEY') ?? '',
      },
      ...(this.endpoint
        ? { endpoint: this.endpoint, forcePathStyle: true }
        : {}),
    });
  }

  get bucketName(): string {
    return this.bucket;
  }

  assertUploadPermitted(file: SupportAttachmentUploadFile): void {
    if (!file.originalname?.trim()) {
      throw new BadRequestException('Filename is required');
    }

    if (!file.size || file.size <= 0) {
      throw new BadRequestException('Empty files cannot be uploaded.');
    }

    const extension = this.getFileExtension(file.originalname);
    if (extension && BLOCKED_ATTACHMENT_EXTENSIONS.has(extension)) {
      throw new BadRequestException(
        `Files with the ${extension} extension are not allowed.`,
      );
    }

    const mimeType = this.normalizeMimeType(file.mimetype);
    const allowedByExtension =
      extension.length > 0 && ALLOWED_ATTACHMENT_EXTENSIONS.has(extension);
    const allowedByMimeType =
      mimeType.length > 0 && ALLOWED_ATTACHMENT_MIME_TYPES.has(mimeType);

    if (!allowedByExtension && !allowedByMimeType) {
      throw new BadRequestException(
        `Unsupported file type. Supported files: ${ALLOWED_ATTACHMENT_TYPES_TEXT}.`,
      );
    }
  }

  createObjectKey(userId: string, originalname: string): string {
    const ext = originalname.includes('.')
      ? originalname.split('.').pop()!
      : 'bin';

    return `coach-attachments/${userId}/${randomUUID()}.${ext}`;
  }

  createDownloadUrl(bucket: string, key: string): string {
    const expiresAt = Date.now() + SUPPORT_ATTACHMENT_TTL_SECONDS * 1000;
    const payload = Buffer.from(
      JSON.stringify({
        bucket,
        key,
        expiresAt,
      } satisfies AttachmentDownloadTokenPayload),
      'utf-8',
    ).toString('base64url');
    const signature = this.signDownloadToken(payload);
    const token = `${payload}.${signature}`;

    return `${this.apiBaseUrl}/api/v1/support/attachments/download?token=${encodeURIComponent(
      token,
    )}`;
  }

  parseDownloadToken(token: string): AttachmentDownloadTokenPayload {
    const [payload, signature] = token.split('.', 2);
    if (!payload || !signature) {
      throw new UnauthorizedException('Invalid attachment token');
    }

    const expectedSignature = this.signDownloadToken(payload);
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Invalid attachment token');
    }

    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf-8'),
    ) as Partial<AttachmentDownloadTokenPayload>;

    if (
      typeof parsed.bucket !== 'string' ||
      typeof parsed.key !== 'string' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      throw new UnauthorizedException('Invalid attachment token');
    }

    if (parsed.expiresAt <= Date.now()) {
      throw new UnauthorizedException('Attachment token expired');
    }

    return parsed as AttachmentDownloadTokenPayload;
  }

  resolveInternalDownloadUrl(
    url: string,
  ): AttachmentDownloadTokenPayload | undefined {
    let parsedUrl: URL;
    let apiBaseUrl: URL;

    try {
      parsedUrl = new URL(url);
      apiBaseUrl = new URL(this.apiBaseUrl);
    } catch {
      return;
    }

    const normalizedPath = parsedUrl.pathname.replace(/\/+$/, '');

    if (
      parsedUrl.origin !== apiBaseUrl.origin ||
      normalizedPath !== '/api/v1/support/attachments/download'
    ) {
      return;
    }

    const token = parsedUrl.searchParams.get('token');
    if (!token) {
      return;
    }

    return this.parseDownloadToken(token);
  }

  async uploadToStorage(
    key: string,
    file: SupportAttachmentUploadFile,
  ): Promise<void> {
    if (this.storageMode === 'ibm-cos-iam') {
      const token = await this.getIbmAccessToken();
      await axios.put(this.buildObjectUrl(this.bucket, key), file.buffer, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': file.mimetype || 'application/octet-stream',
          'Content-Length': String(file.size),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });
      return;
    }

    await this.s3!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
  }

  async getObjectFromStorage(
    bucket: string,
    key: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    if (this.storageMode === 'ibm-cos-iam') {
      const token = await this.getIbmAccessToken();
      const response = await axios.get<ArrayBuffer>(
        this.buildObjectUrl(bucket, key),
        {
          responseType: 'arraybuffer',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      return {
        buffer: Buffer.from(response.data),
        contentType: this.resolveContentTypeHeader(response.headers),
      };
    }

    const response = await this.s3!.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const body = response.Body as
      | { transformToByteArray?: () => Promise<Uint8Array> }
      | undefined;

    if (!body?.transformToByteArray) {
      throw new BadRequestException('Attachment body could not be read');
    }

    return {
      buffer: Buffer.from(await body.transformToByteArray()),
      contentType: response.ContentType ?? 'application/octet-stream',
    };
  }

  async extractTextPreview(
    file: SupportAttachmentUploadFile,
  ): Promise<string | undefined> {
    const contentType = this.normalizeMimeType(file.mimetype);
    const extension = this.getFileExtension(file.originalname);

    try {
      if (contentType === 'application/pdf' || extension === '.pdf') {
        const pdfParseModule = await import('pdf-parse');
        const pdfParse = (
          'default' in pdfParseModule ? pdfParseModule.default : pdfParseModule
        ) as (input: Buffer) => Promise<{ text?: string }>;
        const parsed = await pdfParse(file.buffer);
        return this.normalizeTextPreview(parsed.text);
      }

      if (DOCX_CONTENT_TYPES.has(contentType) || extension === '.docx') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mammoth = require('mammoth') as {
          extractRawText: (input: { buffer: Buffer }) => Promise<{
            value?: string;
          }>;
        };
        const parsed = await mammoth.extractRawText({
          buffer: file.buffer,
        });
        return this.normalizeTextPreview(parsed.value);
      }

      if (XLSX_CONTENT_TYPES.has(contentType) || extension === '.xlsx') {
        return this.extractSpreadsheetPreview(file.buffer);
      }

      if (PPTX_CONTENT_TYPES.has(contentType) || extension === '.pptx') {
        return this.extractPresentationPreview(file.buffer);
      }

      if (
        contentType.startsWith('text/') ||
        contentType === 'application/json' ||
        contentType === 'application/xml' ||
        TEXT_PREVIEW_EXTENSIONS.has(extension)
      ) {
        return this.normalizeTextPreview(file.buffer.toString('utf-8'));
      }
    } catch (error) {
      this.logger.warn(
        `Failed to extract attachment text preview for ${file.originalname}: ${
          (error as Error)?.message ?? error
        }`,
      );
    }

    return;
  }

  private isIbmCosIamConfig(): boolean {
    const accessKeyId = this.config.get<string>('STORAGE_ACCESS_KEY_ID') ?? '';
    const explicitApiKey = this.config.get<string>('IBM_COS_API_KEY') ?? '';

    return (
      this.endpoint?.includes('cloud-object-storage.appdomain.cloud') ===
        true &&
      (accessKeyId.startsWith('ApiKey-') || explicitApiKey.length > 0)
    );
  }

  private getFileExtension(filename: string): string {
    const index = filename.lastIndexOf('.');
    if (index < 0) {
      return '';
    }
    return filename.slice(index).toLowerCase();
  }

  private normalizeMimeType(mimeType: string | undefined): string {
    return mimeType?.toLowerCase().split(';', 1)[0]?.trim() ?? '';
  }

  private normalizeTextPreview(text: string | undefined): string | undefined {
    if (!text) {
      return;
    }

    const normalized = text
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) {
      return;
    }

    return normalized.slice(0, ATTACHMENT_TEXT_PREVIEW_LIMIT);
  }

  private async extractSpreadsheetPreview(
    buffer: Buffer,
  ): Promise<string | undefined> {
    const zip = await JSZip.loadAsync(buffer);
    const fragments: string[] = [];

    const workbookXml = await zip.file('xl/workbook.xml')?.async('text');
    if (workbookXml) {
      fragments.push(
        ...this.extractXmlMatches(
          workbookXml,
          /<sheet\b[^>]*\bname="([^"]+)"/g,
        ),
      );
    }

    const sharedStringsXml = await zip
      .file('xl/sharedStrings.xml')
      ?.async('text');
    if (sharedStringsXml) {
      fragments.push(
        ...this.extractXmlMatches(
          sharedStringsXml,
          /<t(?:\s+xml:space="preserve")?[^>]*>([\s\S]*?)<\/t>/g,
        ),
      );
    }

    return this.normalizeTextPreview(fragments.join('\n'));
  }

  private async extractPresentationPreview(
    buffer: Buffer,
  ): Promise<string | undefined> {
    const zip = await JSZip.loadAsync(buffer);
    const slidePaths = Object.keys(zip.files)
      .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
      .sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true }),
      );
    const fragments: string[] = [];

    for (const slidePath of slidePaths) {
      const slideXml = await zip.file(slidePath)?.async('text');
      if (!slideXml) {
        continue;
      }

      const slideText = this.extractXmlMatches(
        slideXml,
        /<a:t[^>]*>([\s\S]*?)<\/a:t>/g,
      );
      if (slideText.length > 0) {
        fragments.push(slideText.join(' '));
      }
    }

    return this.normalizeTextPreview(fragments.join('\n'));
  }

  private extractXmlMatches(xml: string, pattern: RegExp): string[] {
    const matches: string[] = [];

    for (const match of xml.matchAll(pattern)) {
      const value = this.decodeXmlText(match[1] ?? '');
      if (value) {
        matches.push(value);
      }
    }

    return matches;
  }

  private decodeXmlText(value: string): string {
    return value
      .replace(/&#(\d+);/g, (_, code: string) =>
        String.fromCodePoint(Number.parseInt(code, 10)),
      )
      .replace(/&#x([\da-fA-F]+);/g, (_, code: string) =>
        String.fromCodePoint(Number.parseInt(code, 16)),
      )
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'")
      .trim();
  }

  private buildObjectUrl(bucket: string, key: string): string {
    if (!this.endpoint) {
      throw new BadRequestException('STORAGE_ENDPOINT is required');
    }

    const base = this.endpoint.replace(/\/+$/, '');
    return `${base}/${encodeURIComponent(bucket)}/${this.encodeObjectKey(key)}`;
  }

  private encodeObjectKey(key: string): string {
    return key
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
  }

  private getHeaderValue(
    value: string | string[] | undefined,
    fallback: string,
  ): string {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }

    if (Array.isArray(value) && typeof value[0] === 'string') {
      return value[0];
    }

    return fallback;
  }

  private resolveContentTypeHeader(headers: unknown): string {
    if (!this.isRecord(headers)) {
      return 'application/octet-stream';
    }

    const contentTypeHeader = headers['content-type'];
    return typeof contentTypeHeader === 'string' ||
      Array.isArray(contentTypeHeader)
      ? this.getHeaderValue(contentTypeHeader, 'application/octet-stream')
      : 'application/octet-stream';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private signDownloadToken(payload: string): string {
    return createHmac('sha256', this.downloadSigningSecret)
      .update(payload)
      .digest('base64url');
  }

  private async getIbmAccessToken(): Promise<string> {
    if (this.storageMode !== 'ibm-cos-iam') {
      throw new BadRequestException(
        'IBM COS access token requested in non-IBM mode',
      );
    }

    const now = Date.now();
    if (this.ibmAccessToken && this.ibmAccessToken.expiresAt > now + 60_000) {
      return this.ibmAccessToken.value;
    }

    if (!this.ibmApiKey) {
      throw new BadRequestException(
        'IBM COS API key is not configured. Set IBM_COS_API_KEY or STORAGE_SECRET_ACCESS_KEY.',
      );
    }

    const body = new URLSearchParams({
      apikey: this.ibmApiKey,
      response_type: 'cloud_iam',
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
    });

    const response = await axios.post<IbmIamTokenResponse>(
      IBM_IAM_TOKEN_URL,
      body.toString(),
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    const expiresAt =
      typeof response.data.expiration === 'number'
        ? response.data.expiration * 1000
        : now + (response.data.expires_in ?? 3600) * 1000;

    this.ibmAccessToken = {
      value: response.data.access_token,
      expiresAt,
    };

    return response.data.access_token;
  }
}
