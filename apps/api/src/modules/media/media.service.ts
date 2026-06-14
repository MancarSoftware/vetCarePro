import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMediaDto } from './dto/create-media.dto';
import { MediaQueryDto } from './dto/media-query.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { MediaStorageService } from './media-storage.service';

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorageService,
  ) {}

  async findAll(query: MediaQueryDto) {
    const search = query.search?.trim();
    const where = {
      deletedAt: null,
      ...(query.petId ? { petId: query.petId } : {}),
      ...(query.medicalRecordId
        ? { medicalRecordId: query.medicalRecordId }
        : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(search
        ? {
            OR: [
              {
                originalName: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
              { tags: { has: search.toLowerCase() } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.mediaFile.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          pet: {
            select: {
              id: true,
              name: true,
              species: true,
              breed: true,
            },
          },
          medicalRecord: {
            select: {
              id: true,
              type: true,
              complaint: true,
              occurredAt: true,
            },
          },
          uploadedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.mediaFile.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toPublicMedia(item)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async create(
    actorId: string,
    dto: CreateMediaDto,
    file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Selecciona un archivo para cargar');
    }
    await this.ensurePet(dto.petId);
    if (dto.medicalRecordId) {
      await this.ensureMedicalRecord(dto.medicalRecordId, dto.petId);
    }

    const stored = await this.storage.store(file, dto.petId);
    try {
      const media = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.mediaFile.create({
          data: {
            petId: dto.petId,
            medicalRecordId: dto.medicalRecordId,
            uploadedById: actorId,
            filePath: stored.absolutePath,
            originalName: stored.originalName,
            storedName: stored.storedName,
            mimeType: stored.mimeType,
            sizeBytes: BigInt(stored.sizeBytes),
            category: dto.category,
            tags: this.normalizeTags(dto.tags),
          },
          include: {
            pet: {
              select: {
                id: true,
                name: true,
                species: true,
                breed: true,
              },
            },
            medicalRecord: {
              select: {
                id: true,
                type: true,
                complaint: true,
                occurredAt: true,
              },
            },
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });
        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'CREATE',
            entityType: 'MediaFile',
            entityId: created.id,
            changes: {
              petId: created.petId,
              medicalRecordId: created.medicalRecordId,
              originalName: created.originalName,
              mimeType: created.mimeType,
              sizeBytes: Number(created.sizeBytes),
              category: created.category,
            },
          },
        });
        return created;
      });
      return this.toPublicMedia(media);
    } catch (error) {
      await this.storage.removePhysicalFile(stored.absolutePath).catch(() => {
        // Preserve the original database error if cleanup also fails.
      });
      throw error;
    }
  }

  async update(actorId: string, mediaId: string, dto: UpdateMediaDto) {
    await this.ensureMedia(mediaId);
    const data = {
      ...(dto.category ? { category: dto.category } : {}),
      ...(dto.tags !== undefined
        ? { tags: this.normalizeTags(dto.tags) }
        : {}),
    };
    const media = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.mediaFile.update({
        where: { id: mediaId },
        data,
        include: {
          pet: {
            select: {
              id: true,
              name: true,
              species: true,
              breed: true,
            },
          },
          medicalRecord: {
            select: {
              id: true,
              type: true,
              complaint: true,
              occurredAt: true,
            },
          },
          uploadedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'UPDATE',
          entityType: 'MediaFile',
          entityId: mediaId,
          changes: data,
        },
      });
      return updated;
    });
    return this.toPublicMedia(media);
  }

  async getContent(mediaId: string) {
    const media = await this.ensureMedia(mediaId);
    const file = await this.storage.getFileInfo(media.filePath);
    return {
      ...file,
      mimeType: media.mimeType,
      originalName: media.originalName,
    };
  }

  async remove(actorId: string, mediaId: string) {
    await this.ensureMedia(mediaId);
    await this.prisma.$transaction([
      this.prisma.mediaFile.update({
        where: { id: mediaId },
        data: { deletedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'DELETE',
          entityType: 'MediaFile',
          entityId: mediaId,
        },
      }),
    ]);
    return { success: true };
  }

  private async ensurePet(petId: string) {
    const pet = await this.prisma.pet.findFirst({
      where: { id: petId, deletedAt: null },
      select: { id: true },
    });
    if (!pet) {
      throw new NotFoundException('La mascota no existe');
    }
  }

  private async ensureMedicalRecord(recordId: string, petId: string) {
    const record = await this.prisma.medicalRecord.findFirst({
      where: { id: recordId, petId, deletedAt: null },
      select: { id: true },
    });
    if (!record) {
      throw new NotFoundException(
        'La entrada clínica no existe o pertenece a otra mascota',
      );
    }
  }

  private async ensureMedia(mediaId: string) {
    const media = await this.prisma.mediaFile.findFirst({
      where: { id: mediaId, deletedAt: null },
    });
    if (!media) {
      throw new NotFoundException('El archivo clínico no existe');
    }
    return media;
  }

  private normalizeTags(value?: string): string[] {
    if (!value) return [];
    return [
      ...new Set(
        value
          .split(',')
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean)
          .map((tag) => tag.slice(0, 50)),
      ),
    ].slice(0, 10);
  }

  private toPublicMedia<
    T extends {
      filePath: string;
      storedName: string;
      sizeBytes: bigint;
    },
  >(media: T) {
    const {
      filePath: _filePath,
      storedName: _storedName,
      sizeBytes,
      ...publicMedia
    } = media;
    return {
      ...publicMedia,
      sizeBytes: Number(sizeBytes),
      contentUrl: `/media/${(media as T & { id: string }).id}/content`,
    };
  }
}
