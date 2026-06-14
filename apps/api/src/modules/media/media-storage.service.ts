import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  mkdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

const MAX_FILE_SIZE = 15 * 1024 * 1024;

interface StoredFile {
  absolutePath: string;
  storedName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

@Injectable()
export class MediaStorageService implements OnModuleInit {
  readonly rootPath: string;

  constructor(config: ConfigService) {
    const configuredPath = config.get<string>('UPLOADS_PATH');
    const localBase =
      process.env.LOCALAPPDATA ?? join(process.cwd(), '.vetcare-data');
    this.rootPath = resolve(
      configuredPath ?? join(localBase, 'VetCarePro', 'uploads'),
    );
  }

  async onModuleInit(): Promise<void> {
    await mkdir(this.rootPath, { recursive: true });
  }

  async store(
    file: Express.Multer.File,
    petId: string,
  ): Promise<StoredFile> {
    if (file.buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException(
        'El archivo supera el límite permitido de 15 MB',
      );
    }
    const detected = this.detectFileType(file.buffer);
    const now = new Date();
    const directory = resolve(
      this.rootPath,
      petId,
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0'),
    );
    this.assertWithinRoot(directory);
    await mkdir(directory, { recursive: true });

    const storedName = `${randomUUID()}.${detected.extension}`;
    const absolutePath = resolve(directory, storedName);
    const temporaryPath = `${absolutePath}.tmp`;
    this.assertWithinRoot(absolutePath);

    await writeFile(temporaryPath, file.buffer, { flag: 'wx' });
    await rename(temporaryPath, absolutePath);

    return {
      absolutePath,
      storedName,
      originalName: this.sanitizeOriginalName(file.originalname),
      mimeType: detected.mimeType,
      sizeBytes: file.buffer.length,
    };
  }

  async getFileInfo(filePath: string) {
    const absolutePath = resolve(filePath);
    this.assertWithinRoot(absolutePath);
    let fileStat;
    try {
      fileStat = await stat(absolutePath);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        throw new NotFoundException(
          'El archivo clínico ya no está disponible en el almacenamiento local',
        );
      }
      throw error;
    }
    if (!fileStat.isFile()) {
      throw new BadRequestException('El archivo clínico no es válido');
    }
    return { absolutePath, sizeBytes: fileStat.size };
  }

  async removePhysicalFile(filePath: string): Promise<void> {
    const absolutePath = resolve(filePath);
    this.assertWithinRoot(absolutePath);
    await rm(absolutePath, { force: true });
  }

  private detectFileType(buffer: Buffer) {
    if (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )
    ) {
      return { mimeType: 'image/png', extension: 'png' };
    }
    if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      return { mimeType: 'image/jpeg', extension: 'jpg' };
    }
    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return { mimeType: 'image/webp', extension: 'webp' };
    }
    if (
      buffer.length >= 5 &&
      buffer.subarray(0, 5).toString('ascii') === '%PDF-'
    ) {
      return { mimeType: 'application/pdf', extension: 'pdf' };
    }

    throw new BadRequestException(
      'Formato no permitido. Usa imágenes JPEG, PNG, WebP o documentos PDF',
    );
  }

  private sanitizeOriginalName(originalName: string): string {
    const safeName = basename(originalName)
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim();
    return (safeName || 'archivo-clinico').slice(0, 255);
  }

  private assertWithinRoot(targetPath: string): void {
    const pathFromRoot = relative(this.rootPath, targetPath);
    if (
      pathFromRoot === '..' ||
      pathFromRoot.startsWith(`..${sep}`) ||
      resolve(targetPath) === resolve(this.rootPath)
    ) {
      throw new BadRequestException('La ruta del archivo no es válida');
    }
  }
}
