import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MediaStorageService } from './media-storage.service';

describe('MediaStorageService', () => {
  let rootPath: string;
  let service: MediaStorageService;

  beforeEach(async () => {
    rootPath = await mkdtemp(join(tmpdir(), 'vetcare-media-'));
    const config = {
      get: jest.fn((key: string) =>
        key === 'UPLOADS_PATH' ? rootPath : undefined,
      ),
    } as unknown as ConfigService;
    service = new MediaStorageService(config);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await rm(rootPath, { recursive: true, force: true });
  });

  it('stores a PNG using the detected type and a generated name', async () => {
    const buffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);

    const stored = await service.store(
      fileFixture(buffer, '../radiografia.png', 'application/octet-stream'),
      'pet-id',
    );

    expect(stored.absolutePath).toContain(rootPath);
    expect(stored.storedName).toMatch(/^[\w-]+\.png$/);
    expect(stored.originalName).toBe('radiografia.png');
    expect(stored.mimeType).toBe('image/png');
    expect(await readFile(stored.absolutePath)).toEqual(buffer);
  });

  it('rejects content that only claims to be an image', async () => {
    await expect(
      service.store(
        fileFixture(
          Buffer.from('not-an-image'),
          'evidencia.png',
          'image/png',
        ),
        'pet-id',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks reads outside the configured uploads directory', async () => {
    await expect(
      service.getFileInfo(join(rootPath, '..', 'outside.pdf')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reports a missing local file clearly', async () => {
    await expect(
      service.getFileInfo(join(rootPath, 'pet-id', 'missing.pdf')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

function fileFixture(
  buffer: Buffer,
  originalname: string,
  mimetype: string,
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    destination: '',
    filename: '',
    path: '',
    buffer,
    stream: undefined as never,
  };
}
