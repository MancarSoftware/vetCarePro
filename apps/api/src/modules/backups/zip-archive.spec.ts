import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createZipFromDirectory } from './zip-archive';

describe('createZipFromDirectory', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'vetcare-zip-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('creates a valid zip container with central directory metadata', async () => {
    const uploads = join(tempDir, 'uploads');
    const output = join(tempDir, 'files.zip');
    await mkdir(uploads, { recursive: true });
    await writeFile(join(uploads, 'pet-note.txt'), 'historial clinico');

    const size = await createZipFromDirectory(uploads, output);
    const zip = await readFile(output);

    expect(size).toBeGreaterThan(22);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(zip.includes(Buffer.from('pet-note.txt'))).toBe(true);
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
  });

  it('creates a manifest-only zip when uploads is empty', async () => {
    const output = join(tempDir, 'files.zip');

    const size = await createZipFromDirectory(join(tempDir, 'uploads'), output);
    const zip = await readFile(output);

    expect(size).toBeGreaterThan(22);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(zip.includes(Buffer.from('backup_manifest.json'))).toBe(true);
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
  });
});
