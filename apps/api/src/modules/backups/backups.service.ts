import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';
import { Prisma } from '../../generated/prisma/client';
import { BackupStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaStorageService } from '../media/media-storage.service';
import { BackupsQueryDto } from './dto/backups-query.dto';
import { dumpPostgresDatabase } from './backup-database';
import { createZipFromDirectory } from './zip-archive';

const defaultDatabaseUrl =
  'postgresql://vetcare:vetcare_dev@127.0.0.1:54329/vetcare_pro?schema=public';

const backupInclude = {
  createdBy: {
    select: { id: true, firstName: true, lastName: true },
  },
} satisfies Prisma.BackupRecordInclude;

type BackupWithUser = Prisma.BackupRecordGetPayload<{
  include: typeof backupInclude;
}>;

export type BackupFileKind = 'database' | 'files';

@Injectable()
export class BackupsService implements OnModuleInit {
  readonly rootPath: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mediaStorage: MediaStorageService,
  ) {
    this.rootPath = this.resolveBackupRoot();
  }

  async onModuleInit(): Promise<void> {
    await mkdir(this.rootPath, { recursive: true });
  }

  async findAll(query: BackupsQueryDto) {
    const where: Prisma.BackupRecordWhereInput = {
      ...(query.status ? { status: query.status } : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.backupRecord.findMany({
        where,
        include: backupInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.pageSize,
      }),
      this.prisma.backupRecord.count({ where }),
    ]);

    return {
      items: items.map((item) => this.backupResponse(item)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async getSummary() {
    const [records, lastCompleted] = await this.prisma.$transaction([
      this.prisma.backupRecord.findMany({
        select: { status: true, sizeBytes: true },
      }),
      this.prisma.backupRecord.findFirst({
        where: { status: BackupStatus.COMPLETED },
        orderBy: { completedAt: 'desc' },
        include: backupInclude,
      }),
    ]);

    return {
      backupPath: this.rootPath,
      uploadsPath: this.mediaStorage.rootPath,
      totalBackups: records.length,
      completed: records.filter(
        (record) => record.status === BackupStatus.COMPLETED,
      ).length,
      failed: records.filter((record) => record.status === BackupStatus.FAILED)
        .length,
      pending: records.filter(
        (record) => record.status === BackupStatus.PENDING,
      ).length,
      totalSizeBytes: Number(
        records.reduce(
          (total, record) => total + (record.sizeBytes ?? BigInt(0)),
          BigInt(0),
        ),
      ),
      lastCompleted: lastCompleted
        ? this.backupResponse(lastCompleted)
        : null,
    };
  }

  async create(actorId: string) {
    await mkdir(this.rootPath, { recursive: true });
    const record = await this.prisma.backupRecord.create({
      data: {
        status: BackupStatus.PENDING,
        createdById: actorId,
      },
      include: backupInclude,
    });
    const baseName = `backup_${this.timestamp()}_${record.id.slice(0, 8)}`;
    const databasePath = resolve(this.rootPath, `${baseName}.sql`);
    const filesPath = resolve(this.rootPath, `${baseName}_uploads.zip`);
    this.assertWithinBackupRoot(databasePath);
    this.assertWithinBackupRoot(filesPath);

    try {
      await dumpPostgresDatabase({
        databaseUrl: this.config.get<string>('DATABASE_URL') ?? defaultDatabaseUrl,
        outputPath: databasePath,
        pgDumpPath: this.config.get<string>('PG_DUMP_PATH'),
      });
      await createZipFromDirectory(this.mediaStorage.rootPath, filesPath);
      const [databaseStat, filesStat] = await Promise.all([
        stat(databasePath),
        stat(filesPath),
      ]);
      const sizeBytes = BigInt(databaseStat.size + filesStat.size);

      const completed = await this.prisma.$transaction(async (transaction) => {
        const updated = await transaction.backupRecord.update({
          where: { id: record.id },
          data: {
            status: BackupStatus.COMPLETED,
            databasePath,
            filesPath,
            sizeBytes,
            completedAt: new Date(),
          },
          include: backupInclude,
        });
        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'BACKUP',
            entityType: 'BackupRecord',
            entityId: record.id,
            changes: {
              status: BackupStatus.COMPLETED,
              databasePath,
              filesPath,
              sizeBytes: Number(sizeBytes),
            },
          },
        });
        return updated;
      });

      return this.backupResponse(completed);
    } catch (error) {
      await Promise.all([
        rm(databasePath, { force: true }).catch(() => undefined),
        rm(filesPath, { force: true }).catch(() => undefined),
      ]);
      const message = this.errorMessage(error);
      await this.prisma.$transaction([
        this.prisma.backupRecord.update({
          where: { id: record.id },
          data: {
            status: BackupStatus.FAILED,
            errorMessage: message,
            completedAt: new Date(),
          },
        }),
        this.prisma.auditLog.create({
          data: {
            actorId,
            action: 'BACKUP',
            entityType: 'BackupRecord',
            entityId: record.id,
            changes: {
              status: BackupStatus.FAILED,
              errorMessage: message,
            },
          },
        }),
      ]);
      throw new BadRequestException(`No fue posible crear el backup. ${message}`);
    }
  }

  async getFile(backupId: string, kind: BackupFileKind) {
    const backup = await this.ensureCompletedBackup(backupId);
    const filePath = kind === 'database' ? backup.databasePath : backup.filesPath;
    if (!filePath) {
      throw new NotFoundException('El archivo del backup no esta disponible');
    }
    const absolutePath = resolve(filePath);
    this.assertWithinBackupRoot(absolutePath);
    const fileStat = await stat(absolutePath).catch(() => null);
    if (!fileStat?.isFile()) {
      throw new NotFoundException('El archivo del backup ya no existe');
    }
    return {
      absolutePath,
      fileName: basename(absolutePath),
      sizeBytes: fileStat.size,
      mimeType:
        kind === 'database'
          ? 'application/sql; charset=utf-8'
          : 'application/zip',
      stream: createReadStream(absolutePath),
    };
  }

  async remove(actorId: string, backupId: string) {
    const backup = await this.prisma.backupRecord.findUnique({
      where: { id: backupId },
    });
    if (!backup) {
      throw new NotFoundException('El backup no existe');
    }
    await Promise.all(
      [backup.databasePath, backup.filesPath]
        .filter((value): value is string => Boolean(value))
        .map(async (filePath) => {
          const absolutePath = resolve(filePath);
          this.assertWithinBackupRoot(absolutePath);
          await rm(absolutePath, { force: true });
        }),
    );
    await this.prisma.$transaction([
      this.prisma.backupRecord.delete({ where: { id: backupId } }),
      this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'DELETE',
          entityType: 'BackupRecord',
          entityId: backupId,
        },
      }),
    ]);
    return { success: true };
  }

  private async ensureCompletedBackup(backupId: string) {
    const backup = await this.prisma.backupRecord.findUnique({
      where: { id: backupId },
    });
    if (!backup) {
      throw new NotFoundException('El backup no existe');
    }
    if (backup.status !== BackupStatus.COMPLETED) {
      throw new BadRequestException('El backup todavia no esta completo');
    }
    return backup;
  }

  private backupResponse(backup: BackupWithUser) {
    return {
      ...backup,
      sizeBytes: backup.sizeBytes ? Number(backup.sizeBytes) : null,
    };
  }

  private resolveBackupRoot(): string {
    const configured =
      this.config.get<string>('BACKUPS_PATH') ??
      this.config.get<string>('VETCARE_BACKUPS_PATH');
    if (configured) return resolve(configured);

    const dataDir = this.config.get<string>('VETCARE_DATA_DIR');
    if (dataDir) return resolve(process.cwd(), dataDir, 'backups');

    const localBase =
      process.env.LOCALAPPDATA ?? join(process.cwd(), '.vetcare-data');
    return resolve(localBase, 'VetCarePro', 'backups');
  }

  private assertWithinBackupRoot(targetPath: string): void {
    const pathFromRoot = relative(this.rootPath, resolve(targetPath));
    if (pathFromRoot === '..' || pathFromRoot.startsWith(`..${sep}`)) {
      throw new BadRequestException('La ruta del backup no es valida');
    }
  }

  private timestamp(): string {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join('_');
  }

  private errorMessage(error: unknown): string {
    return (error instanceof Error ? error.message : String(error)).slice(
      0,
      1800,
    );
  }
}
