import type { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import JSZip from 'jszip';
import { SupportAttachmentStorageService } from './support-attachment-storage.service';

jest.mock('mammoth', () => ({
  extractRawText: jest.fn(() =>
    Promise.resolve({
      value: 'Codex improves developer workflows and shortens review cycles.',
    }),
  ),
}));

describe('SupportAttachmentStorageService', () => {
  const createConfigServiceMock = (
    values: Record<string, string | undefined>,
  ): ConfigService =>
    ({
      get: jest.fn((key: string) => values[key]),
    }) as unknown as ConfigService;

  it('creates stateless signed download URLs that can be resolved back to storage keys', () => {
    const service = new SupportAttachmentStorageService(
      createConfigServiceMock({
        API_BASE_URL: 'http://localhost:8000',
        JWT_SECRET: 'test-secret',
      }),
    );

    const url = service.createDownloadUrl(
      'pitch-storage',
      'coach-attachments/user-1/file.pdf',
    );

    expect(url).toContain('/api/v1/support/attachments/download?token=');
    const resolved = service.resolveInternalDownloadUrl(url);

    expect(resolved).toMatchObject({
      bucket: 'pitch-storage',
      key: 'coach-attachments/user-1/file.pdf',
    });
    expect(typeof resolved?.expiresAt).toBe('number');
  });

  it('rejects tampered attachment tokens', () => {
    const service = new SupportAttachmentStorageService(
      createConfigServiceMock({
        API_BASE_URL: 'http://localhost:8000',
        JWT_SECRET: 'test-secret',
      }),
    );

    const url = service.createDownloadUrl(
      'pitch-storage',
      'coach-attachments/user-1/file.pdf',
    );
    const parsed = new URL(url);
    const token = parsed.searchParams.get('token')!;
    const [payload, signature] = token.split('.', 2);
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        bucket: 'pitch-storage',
        key: 'coach-attachments/user-1/other.pdf',
        expiresAt: Date.now() + 10_000,
      }),
      'utf-8',
    ).toString('base64url');

    expect(() =>
      service.parseDownloadToken(`${tamperedPayload}.${signature}`),
    ).toThrow(UnauthorizedException);
    expect(() => service.parseDownloadToken(`${payload}.short`)).toThrow(
      UnauthorizedException,
    );
  });

  it('extracts text previews from docx uploads', async () => {
    const service = new SupportAttachmentStorageService(
      createConfigServiceMock({
        API_BASE_URL: 'http://localhost:8000',
        JWT_SECRET: 'test-secret',
      }),
    );

    const preview = await service.extractTextPreview({
      originalname: 'brief.docx',
      mimetype:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.from('placeholder'),
      size: 11,
    });

    expect(preview).toContain('Codex improves developer workflows');
  });

  it('extracts text previews from xlsx uploads', async () => {
    const zip = new JSZip();
    zip.file(
      'xl/workbook.xml',
      '<workbook><sheets><sheet name="Customer Priorities"/></sheets></workbook>',
    );
    zip.file(
      'xl/sharedStrings.xml',
      '<sst><si><t>Security review</t></si><si><t>ROI model</t></si></sst>',
    );
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const service = new SupportAttachmentStorageService(
      createConfigServiceMock({
        API_BASE_URL: 'http://localhost:8000',
        JWT_SECRET: 'test-secret',
      }),
    );

    const preview = await service.extractTextPreview({
      originalname: 'brief.xlsx',
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
      size: buffer.length,
    });

    expect(preview).toContain('Customer Priorities');
    expect(preview).toContain('Security review');
    expect(preview).toContain('ROI model');
  });

  it('extracts text previews from pptx uploads', async () => {
    const zip = new JSZip();
    zip.file(
      'ppt/slides/slide1.xml',
      '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Codex rollout plan</a:t></a:r></a:p><a:p><a:r><a:t>Three pilot teams</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>',
    );
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const service = new SupportAttachmentStorageService(
      createConfigServiceMock({
        API_BASE_URL: 'http://localhost:8000',
        JWT_SECRET: 'test-secret',
      }),
    );

    const preview = await service.extractTextPreview({
      originalname: 'deck.pptx',
      mimetype:
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      buffer,
      size: buffer.length,
    });

    expect(preview).toContain('Codex rollout plan');
    expect(preview).toContain('Three pilot teams');
  });

  it('rejects unsupported file types', () => {
    const service = new SupportAttachmentStorageService(
      createConfigServiceMock({
        API_BASE_URL: 'http://localhost:8000',
        JWT_SECRET: 'test-secret',
      }),
    );

    expect(() =>
      service.assertUploadPermitted({
        originalname: 'archive.zip',
        mimetype: 'application/zip',
        buffer: Buffer.from('zip'),
        size: 3,
      }),
    ).toThrow(BadRequestException);
  });
});
