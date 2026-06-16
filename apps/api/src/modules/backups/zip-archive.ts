import { createWriteStream } from 'node:fs';
import { mkdir, readdir, readFile, stat } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { deflateRaw } from 'node:zlib';

const deflateRawAsync = promisify(deflateRaw);
const UTF8_FLAG = 0x0800;
const DEFLATE_METHOD = 8;

interface ZipEntryInput {
  archivePath: string;
  data: Buffer;
  modifiedAt: Date;
}

interface CentralDirectoryEntry {
  archivePath: string;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  offset: number;
  modifiedAt: Date;
}

export async function createZipFromDirectory(
  sourceDirectory: string,
  outputPath: string,
): Promise<number> {
  await mkdir(dirname(outputPath), { recursive: true });
  await mkdir(sourceDirectory, { recursive: true });

  const files = await collectFiles(sourceDirectory);
  const entries =
    files.length > 0
      ? await Promise.all(
          files.map(async (file) => ({
            archivePath: file.archivePath,
            data: await readFile(file.absolutePath),
            modifiedAt: file.modifiedAt,
          })),
        )
      : [
          {
            archivePath: 'backup_manifest.json',
            data: Buffer.from(
              JSON.stringify(
                {
                  createdAt: new Date().toISOString(),
                  note: 'No hay archivos clinicos registrados en uploads.',
                },
                null,
                2,
              ),
              'utf8',
            ),
            modifiedAt: new Date(),
          },
        ];

  return writeZip(entries, outputPath);
}

async function collectFiles(sourceDirectory: string) {
  const root = resolve(sourceDirectory);
  const result: Array<{
    absolutePath: string;
    archivePath: string;
    modifiedAt: Date;
  }> = [];

  async function visit(directory: string) {
    const items = await readdir(directory, { withFileTypes: true });
    for (const item of items) {
      const absolutePath = resolve(directory, item.name);
      if (item.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      if (!item.isFile()) continue;
      const fileStat = await stat(absolutePath);
      const archivePath = relative(root, absolutePath).split(sep).join('/');
      result.push({
        absolutePath,
        archivePath,
        modifiedAt: fileStat.mtime,
      });
    }
  }

  await visit(root);
  return result.sort((a, b) => a.archivePath.localeCompare(b.archivePath));
}

async function writeZip(
  entries: ZipEntryInput[],
  outputPath: string,
): Promise<number> {
  const stream = createWriteStream(outputPath, { flags: 'w' });
  let bytesWritten = 0;
  const centralEntries: CentralDirectoryEntry[] = [];

  const write = (buffer: Buffer) =>
    new Promise<void>((resolve, reject) => {
      stream.write(buffer, (error) => {
        if (error) {
          reject(error);
          return;
        }
        bytesWritten += buffer.length;
        resolve();
      });
    });

  try {
    for (const entry of entries) {
      const compressed = await deflateRawAsync(entry.data);
      const crc = crc32(entry.data);
      const name = Buffer.from(entry.archivePath, 'utf8');
      const offset = bytesWritten;
      await write(
        localFileHeader({
          name,
          crc,
          compressedSize: compressed.length,
          uncompressedSize: entry.data.length,
          modifiedAt: entry.modifiedAt,
        }),
      );
      await write(name);
      await write(compressed);
      centralEntries.push({
        archivePath: entry.archivePath,
        crc,
        compressedSize: compressed.length,
        uncompressedSize: entry.data.length,
        offset,
        modifiedAt: entry.modifiedAt,
      });
    }

    const centralDirectoryOffset = bytesWritten;
    for (const entry of centralEntries) {
      const name = Buffer.from(entry.archivePath, 'utf8');
      await write(centralDirectoryHeader({ ...entry, name }));
      await write(name);
    }
    const centralDirectorySize = bytesWritten - centralDirectoryOffset;
    await write(
      endOfCentralDirectory({
        entryCount: centralEntries.length,
        centralDirectorySize,
        centralDirectoryOffset,
      }),
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      stream.end((error?: Error | null) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  return bytesWritten;
}

function localFileHeader(input: {
  name: Buffer;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  modifiedAt: Date;
}) {
  const header = Buffer.alloc(30);
  const time = dosDateTime(input.modifiedAt);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(UTF8_FLAG, 6);
  header.writeUInt16LE(DEFLATE_METHOD, 8);
  header.writeUInt16LE(time.time, 10);
  header.writeUInt16LE(time.date, 12);
  header.writeUInt32LE(input.crc, 14);
  header.writeUInt32LE(input.compressedSize, 18);
  header.writeUInt32LE(input.uncompressedSize, 22);
  header.writeUInt16LE(input.name.length, 26);
  header.writeUInt16LE(0, 28);
  return header;
}

function centralDirectoryHeader(
  input: CentralDirectoryEntry & { name: Buffer },
) {
  const header = Buffer.alloc(46);
  const time = dosDateTime(input.modifiedAt);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(UTF8_FLAG, 8);
  header.writeUInt16LE(DEFLATE_METHOD, 10);
  header.writeUInt16LE(time.time, 12);
  header.writeUInt16LE(time.date, 14);
  header.writeUInt32LE(input.crc, 16);
  header.writeUInt32LE(input.compressedSize, 20);
  header.writeUInt32LE(input.uncompressedSize, 24);
  header.writeUInt16LE(input.name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(input.offset, 42);
  return header;
}

function endOfCentralDirectory(input: {
  entryCount: number;
  centralDirectorySize: number;
  centralDirectoryOffset: number;
}) {
  const header = Buffer.alloc(22);
  header.writeUInt32LE(0x06054b50, 0);
  header.writeUInt16LE(0, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(input.entryCount, 8);
  header.writeUInt16LE(input.entryCount, 10);
  header.writeUInt32LE(input.centralDirectorySize, 12);
  header.writeUInt32LE(input.centralDirectoryOffset, 16);
  header.writeUInt16LE(0, 20);
  return header;
}

function dosDateTime(date: Date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    date:
      ((year - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate(),
  };
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});
