import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { MedicalRecordsQueryDto } from './dto/medical-records-query.dto';
import { MedicationDto } from './dto/medication.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';

@Injectable()
export class MedicalRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: MedicalRecordsQueryDto) {
    const search = query.search?.trim();
    const where = {
      deletedAt: null,
      ...(query.petId ? { petId: query.petId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(search
        ? {
            OR: [
              { complaint: { contains: search, mode: 'insensitive' as const } },
              { symptoms: { contains: search, mode: 'insensitive' as const } },
              { diagnosis: { contains: search, mode: 'insensitive' as const } },
              {
                treatmentPlan: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
              {
                pet: {
                  OR: [
                    { name: { contains: search, mode: 'insensitive' as const } },
                    {
                      owner: {
                        OR: [
                          {
                            firstName: {
                              contains: search,
                              mode: 'insensitive' as const,
                            },
                          },
                          {
                            lastName: {
                              contains: search,
                              mode: 'insensitive' as const,
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.medicalRecord.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          pet: {
            select: {
              id: true,
              name: true,
              species: true,
              breed: true,
              status: true,
              owner: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  phone: true,
                },
              },
            },
          },
          veterinarian: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              treatments: { where: { deletedAt: null } },
              vaccines: { where: { deletedAt: null } },
              dewormings: { where: { deletedAt: null } },
              mediaFiles: { where: { deletedAt: null } },
            },
          },
        },
      }),
      this.prisma.medicalRecord.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async findOne(recordId: string) {
    const record = await this.prisma.medicalRecord.findFirst({
      where: { id: recordId, deletedAt: null },
      include: {
        pet: { include: { owner: true } },
        veterinarian: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        treatments: { where: { deletedAt: null } },
        vaccines: { where: { deletedAt: null } },
        dewormings: { where: { deletedAt: null } },
        mediaFiles: { where: { deletedAt: null } },
      },
    });
    if (!record) {
      throw new NotFoundException('La entrada clínica no existe');
    }
    return record;
  }

  async create(actorId: string, dto: CreateMedicalRecordDto) {
    await this.ensurePet(dto.petId);
    const data = this.normalizeCreate(actorId, dto);
    this.validateClinicalContent(data);
    this.validateDates(data.occurredAt, data.nextReviewAt);

    return this.prisma.$transaction(async (transaction) => {
      const record = await transaction.medicalRecord.create({
        data,
        include: {
          pet: {
            select: { id: true, name: true },
          },
          veterinarian: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'CREATE',
          entityType: 'MedicalRecord',
          entityId: record.id,
          changes: {
            petId: record.petId,
            type: record.type,
            occurredAt: record.occurredAt.toISOString(),
          },
        },
      });
      return record;
    });
  }

  async update(
    actorId: string,
    recordId: string,
    dto: UpdateMedicalRecordDto,
  ) {
    const current = await this.ensureRecord(recordId);
    const data = this.normalizeUpdate(dto);
    const merged = {
      complaint:
        data.complaint !== undefined ? data.complaint : current.complaint,
      symptoms: data.symptoms !== undefined ? data.symptoms : current.symptoms,
      diagnosis:
        data.diagnosis !== undefined ? data.diagnosis : current.diagnosis,
      treatmentPlan:
        data.treatmentPlan !== undefined
          ? data.treatmentPlan
          : current.treatmentPlan,
      medications:
        data.medications !== undefined
          ? data.medications
          : current.medications,
      notes: data.notes !== undefined ? data.notes : current.notes,
    };
    this.validateClinicalContent(merged);
    this.validateDates(
      data.occurredAt ?? current.occurredAt,
      data.nextReviewAt !== undefined
        ? data.nextReviewAt
        : current.nextReviewAt,
    );

    return this.prisma.$transaction(async (transaction) => {
      const record = await transaction.medicalRecord.update({
        where: { id: recordId },
        data,
        include: {
          pet: { select: { id: true, name: true } },
          veterinarian: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'UPDATE',
          entityType: 'MedicalRecord',
          entityId: recordId,
          changes: this.auditChanges(data),
        },
      });
      return record;
    });
  }

  async remove(actorId: string, recordId: string) {
    await this.ensureRecord(recordId);
    const links = await this.prisma.medicalRecord.findUnique({
      where: { id: recordId },
      select: {
        _count: {
          select: {
            treatments: { where: { deletedAt: null } },
            vaccines: { where: { deletedAt: null } },
            dewormings: { where: { deletedAt: null } },
            mediaFiles: { where: { deletedAt: null } },
          },
        },
      },
    });
    const linkedItems = links
      ? Object.values(links._count).reduce((sum, count) => sum + count, 0)
      : 0;
    if (linkedItems > 0) {
      throw new ConflictException(
        'No se puede archivar una entrada con tratamientos, vacunas o archivos vinculados',
      );
    }

    await this.prisma.$transaction([
      this.prisma.medicalRecord.update({
        where: { id: recordId },
        data: { deletedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'DELETE',
          entityType: 'MedicalRecord',
          entityId: recordId,
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

  private async ensureRecord(recordId: string) {
    const record = await this.prisma.medicalRecord.findFirst({
      where: { id: recordId, deletedAt: null },
    });
    if (!record) {
      throw new NotFoundException('La entrada clínica no existe');
    }
    return record;
  }

  private normalizeCreate(actorId: string, dto: CreateMedicalRecordDto) {
    return {
      petId: dto.petId,
      veterinarianId: actorId,
      type: dto.type,
      occurredAt: new Date(dto.occurredAt),
      complaint: this.optionalText(dto.complaint),
      symptoms: this.optionalText(dto.symptoms),
      diagnosis: this.optionalText(dto.diagnosis),
      treatmentPlan: this.optionalText(dto.treatmentPlan),
      medications: this.toJsonValue(this.normalizeMedications(dto.medications)),
      notes: this.optionalText(dto.notes),
      nextReviewAt: dto.nextReviewAt ? new Date(dto.nextReviewAt) : null,
    };
  }

  private normalizeUpdate(dto: UpdateMedicalRecordDto) {
    return {
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.occurredAt !== undefined
        ? { occurredAt: new Date(dto.occurredAt) }
        : {}),
      ...(dto.complaint !== undefined
        ? { complaint: this.optionalText(dto.complaint) }
        : {}),
      ...(dto.symptoms !== undefined
        ? { symptoms: this.optionalText(dto.symptoms) }
        : {}),
      ...(dto.diagnosis !== undefined
        ? { diagnosis: this.optionalText(dto.diagnosis) }
        : {}),
      ...(dto.treatmentPlan !== undefined
        ? { treatmentPlan: this.optionalText(dto.treatmentPlan) }
        : {}),
      ...(dto.medications !== undefined
        ? {
            medications: this.toJsonValue(
              this.normalizeMedications(dto.medications),
            ),
          }
        : {}),
      ...(dto.notes !== undefined
        ? { notes: this.optionalText(dto.notes) }
        : {}),
      ...(dto.nextReviewAt !== undefined
        ? {
            nextReviewAt: dto.nextReviewAt
              ? new Date(dto.nextReviewAt)
              : null,
          }
        : {}),
    };
  }

  private normalizeMedications(
    medications: MedicationDto[] | null | undefined,
  ) {
    if (!medications?.length) return null;
    return medications.map((medication) => ({
      name: medication.name.trim(),
      dosage: this.optionalText(medication.dosage),
      frequency: this.optionalText(medication.frequency),
      duration: this.optionalText(medication.duration),
    }));
  }

  private validateClinicalContent(data: {
    complaint?: string | null;
    symptoms?: string | null;
    diagnosis?: string | null;
    treatmentPlan?: string | null;
    medications?: unknown;
    notes?: string | null;
  }) {
    if (
      !data.complaint &&
      !data.symptoms &&
      !data.diagnosis &&
      !data.treatmentPlan &&
      !(Array.isArray(data.medications) && data.medications.length > 0) &&
      !data.notes
    ) {
      throw new BadRequestException(
        'Registra al menos un detalle clínico en la entrada',
      );
    }
  }

  private validateDates(occurredAt: Date, nextReviewAt: Date | null) {
    if (occurredAt.getTime() > Date.now() + 5 * 60_000) {
      throw new BadRequestException(
        'La fecha de atención no puede estar en el futuro',
      );
    }
    if (nextReviewAt && nextReviewAt <= occurredAt) {
      throw new BadRequestException(
        'La próxima revisión debe ser posterior a la atención',
      );
    }
  }

  private toJsonValue(value: ReturnType<typeof this.normalizeMedications>) {
    return value ?? Prisma.DbNull;
  }

  private auditChanges(data: Record<string, unknown>): Prisma.InputJsonObject {
    const changes: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value instanceof Date) {
        changes[key] = value.toISOString();
      } else if (value === Prisma.DbNull) {
        changes[key] = null;
      } else {
        changes[key] = value as Prisma.InputJsonValue;
      }
    }
    return changes as Prisma.InputJsonObject;
  }

  private optionalText(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }
}
