import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  TreatmentEvolutionStatus,
  TreatmentStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { MedicationDto } from '../medical-records/dto/medication.dto';
import {
  parseDateOnly,
  todayDateOnly,
} from '../preventive-care/preventive-care-status';
import { CreateTreatmentEvolutionDto } from './dto/create-treatment-evolution.dto';
import { CreateTreatmentDto } from './dto/create-treatment.dto';
import { TreatmentsQueryDto } from './dto/treatments-query.dto';
import { UpdateTreatmentEvolutionDto } from './dto/update-treatment-evolution.dto';
import { UpdateTreatmentDto } from './dto/update-treatment.dto';
import {
  normalizeTreatmentDates,
  validateEvolutionDates,
} from './treatment-dates';

type NormalizedMedication = {
  name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
};

const treatmentInclude = {
  pet: {
    select: {
      id: true,
      name: true,
      species: true,
      breed: true,
      weightKg: true,
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
  medicalRecord: {
    select: {
      id: true,
      type: true,
      complaint: true,
      occurredAt: true,
    },
  },
  veterinarian: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  evolutions: {
    where: { deletedAt: null },
    orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    take: 1,
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  },
  _count: {
    select: {
      evolutions: { where: { deletedAt: null } },
      mediaFiles: { where: { deletedAt: null } },
    },
  },
} satisfies Prisma.TreatmentInclude;

@Injectable()
export class TreatmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: TreatmentsQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.TreatmentWhereInput = {
      deletedAt: null,
      pet: { deletedAt: null },
      ...(query.petId ? { petId: query.petId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            startDate: {
              ...(query.dateFrom
                ? { gte: parseDateOnly(query.dateFrom) }
                : {}),
              ...(query.dateTo ? { lte: parseDateOnly(query.dateTo) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { diagnosis: { contains: search, mode: 'insensitive' } },
              { instructions: { contains: search, mode: 'insensitive' } },
              { notes: { contains: search, mode: 'insensitive' } },
              {
                pet: {
                  OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    {
                      owner: {
                        OR: [
                          {
                            firstName: {
                              contains: search,
                              mode: 'insensitive',
                            },
                          },
                          {
                            lastName: {
                              contains: search,
                              mode: 'insensitive',
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
      this.prisma.treatment.findMany({
        where,
        include: treatmentInclude,
        orderBy: [{ updatedAt: 'desc' }, { startDate: 'desc' }],
        skip,
        take: query.pageSize,
      }),
      this.prisma.treatment.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async getSummary(petId?: string) {
    const where = {
      deletedAt: null,
      ...(petId ? { petId } : {}),
      pet: { deletedAt: null },
    };
    const [active, followUp, completed, suspended, overdue] =
      await this.prisma.$transaction([
        this.prisma.treatment.count({
          where: { ...where, status: TreatmentStatus.ACTIVE },
        }),
        this.prisma.treatment.count({
          where: { ...where, status: TreatmentStatus.FOLLOW_UP },
        }),
        this.prisma.treatment.count({
          where: { ...where, status: TreatmentStatus.COMPLETED },
        }),
        this.prisma.treatment.count({
          where: { ...where, status: TreatmentStatus.SUSPENDED },
        }),
        this.prisma.treatment.count({
          where: {
            ...where,
            status: {
              in: [TreatmentStatus.ACTIVE, TreatmentStatus.FOLLOW_UP],
            },
            endDate: { lt: todayDateOnly() },
          },
        }),
      ]);
    return {
      total: active + followUp + completed + suspended,
      active,
      followUp,
      completed,
      suspended,
      overdue,
    };
  }

  async findOne(treatmentId: string) {
    const treatment = await this.prisma.treatment.findFirst({
      where: { id: treatmentId, deletedAt: null },
      include: {
        ...treatmentInclude,
        evolutions: {
          where: { deletedAt: null },
          orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
          include: {
            createdBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        mediaFiles: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
            category: true,
            tags: true,
            createdAt: true,
          },
        },
      },
    });
    if (!treatment) {
      throw new NotFoundException('El tratamiento no existe');
    }
    return this.toResponse({
      ...treatment,
      mediaFiles: treatment.mediaFiles.map((media) => ({
        ...media,
        sizeBytes: Number(media.sizeBytes),
        contentUrl: `/media/${media.id}/content`,
      })),
    });
  }

  async create(actorId: string, dto: CreateTreatmentDto) {
    await this.ensurePet(dto.petId);
    if (dto.medicalRecordId) {
      await this.ensureMedicalRecord(dto.medicalRecordId, dto.petId);
    }
    const dates = normalizeTreatmentDates(dto);
    const status = dto.status ?? TreatmentStatus.ACTIVE;
    this.validateCompletedTreatment(status, dates.startDate, dates.endDate);
    if (status === TreatmentStatus.COMPLETED && !dates.endDate) {
      dates.endDate = todayDateOnly();
      dates.durationDays =
        Math.round(
          (dates.endDate.getTime() - dates.startDate.getTime()) /
            (24 * 60 * 60_000),
        ) + 1;
    }
    const medications = this.normalizeMedications(dto.medications);
    const diagnosis = dto.diagnosis.trim();
    const instructions = dto.instructions.trim();
    const notes = this.optionalText(dto.notes);

    return this.prisma.$transaction(async (transaction) => {
      const medicalRecordId =
        dto.medicalRecordId ??
        (
          await this.createAutomaticMedicalRecord(transaction, {
            actorId,
            petId: dto.petId,
            diagnosis,
            instructions,
            medications,
            notes,
            startDate: dates.startDate,
            endDate: dates.endDate,
          })
        ).id;
      const treatment = await transaction.treatment.create({
        data: {
          petId: dto.petId,
          medicalRecordId,
          veterinarianId: actorId,
          diagnosis,
          instructions,
          medications: this.toJsonValue(medications),
          dosage: this.optionalText(dto.dosage),
          frequency: this.optionalText(dto.frequency),
          ...dates,
          status,
          notes,
        },
        include: treatmentInclude,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'CREATE',
          entityType: 'Treatment',
          entityId: treatment.id,
          changes: {
            petId: treatment.petId,
            medicalRecordId: treatment.medicalRecordId,
            diagnosis: treatment.diagnosis,
            status: treatment.status,
            startDate: treatment.startDate.toISOString(),
            endDate: treatment.endDate?.toISOString() ?? null,
          },
        },
      });
      return this.toResponse(treatment);
    });
  }

  async update(
    actorId: string,
    treatmentId: string,
    dto: UpdateTreatmentDto,
  ) {
    const current = await this.ensureTreatment(treatmentId);
    const startValue =
      dto.startDate ?? current.startDate.toISOString().slice(0, 10);
    const endValue =
      dto.endDate !== undefined
        ? dto.endDate
        : current.endDate?.toISOString().slice(0, 10);
    const durationValue =
      dto.durationDays !== undefined
        ? dto.durationDays
        : current.durationDays;
    const dates = normalizeTreatmentDates({
      startDate: startValue,
      endDate: endValue,
      durationDays: durationValue,
    });
    const status = dto.status ?? current.status;
    this.validateCompletedTreatment(status, dates.startDate, dates.endDate);
    if (status === TreatmentStatus.COMPLETED && !dates.endDate) {
      dates.endDate = todayDateOnly();
      dates.durationDays =
        Math.round(
          (dates.endDate.getTime() - dates.startDate.getTime()) /
            (24 * 60 * 60_000),
        ) + 1;
    }

    const data = {
      ...(dto.diagnosis !== undefined
        ? { diagnosis: dto.diagnosis.trim() }
        : {}),
      ...(dto.instructions !== undefined
        ? { instructions: dto.instructions.trim() }
        : {}),
      ...(dto.medications !== undefined
        ? {
            medications: this.toJsonValue(
              this.normalizeMedications(dto.medications),
            ),
          }
        : {}),
      ...(dto.dosage !== undefined
        ? { dosage: this.optionalText(dto.dosage) }
        : {}),
      ...(dto.frequency !== undefined
        ? { frequency: this.optionalText(dto.frequency) }
        : {}),
      ...(dto.startDate !== undefined ? { startDate: dates.startDate } : {}),
      ...(dto.endDate !== undefined || dto.durationDays !== undefined
        ? {
            endDate: dates.endDate,
            durationDays: dates.durationDays,
          }
        : {}),
      ...(dto.status !== undefined ? { status } : {}),
      ...(status === TreatmentStatus.COMPLETED && !current.endDate
        ? {
            endDate: dates.endDate,
            durationDays: dates.durationDays,
          }
        : {}),
      ...(dto.notes !== undefined
        ? { notes: this.optionalText(dto.notes) }
        : {}),
    };

    const treatment = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.treatment.update({
        where: { id: treatmentId },
        data,
        include: treatmentInclude,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'UPDATE',
          entityType: 'Treatment',
          entityId: treatmentId,
          changes: this.auditChanges(data),
        },
      });
      return updated;
    });
    return this.toResponse(treatment);
  }

  async remove(actorId: string, treatmentId: string) {
    await this.ensureTreatment(treatmentId);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.treatment.update({
        where: { id: treatmentId },
        data: { deletedAt: now },
      }),
      this.prisma.treatmentEvolution.updateMany({
        where: { treatmentId, deletedAt: null },
        data: { deletedAt: now },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'DELETE',
          entityType: 'Treatment',
          entityId: treatmentId,
        },
      }),
    ]);
    return { success: true };
  }

  async createEvolution(
    actorId: string,
    treatmentId: string,
    dto: CreateTreatmentEvolutionDto,
  ) {
    const treatment = await this.ensureTreatment(treatmentId);
    const occurredAt = new Date(dto.occurredAt);
    const nextReviewAt = dto.nextReviewAt
      ? new Date(dto.nextReviewAt)
      : null;
    validateEvolutionDates({
      treatmentStartDate: treatment.startDate,
      occurredAt,
      nextReviewAt,
    });

    return this.prisma.$transaction(async (transaction) => {
      const evolution = await transaction.treatmentEvolution.create({
        data: {
          treatmentId,
          createdById: actorId,
          status: dto.status,
          title: this.optionalText(dto.title),
          notes: dto.notes.trim(),
          weightKg: dto.weightKg ?? null,
          occurredAt,
          nextReviewAt,
        },
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
      if (dto.status === TreatmentEvolutionStatus.RECOVERED) {
        const endDate = this.dateOnlyFromInstant(occurredAt);
        const durationDays =
          Math.round(
            (endDate.getTime() - treatment.startDate.getTime()) /
              (24 * 60 * 60_000),
          ) + 1;
        await transaction.treatment.update({
          where: { id: treatmentId },
          data: {
            status: TreatmentStatus.COMPLETED,
            endDate,
            durationDays,
          },
        });
      }
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'CREATE',
          entityType: 'TreatmentEvolution',
          entityId: evolution.id,
          changes: {
            treatmentId,
            status: evolution.status,
            occurredAt: evolution.occurredAt.toISOString(),
          },
        },
      });
      return this.evolutionResponse(evolution);
    });
  }

  async updateEvolution(
    actorId: string,
    treatmentId: string,
    evolutionId: string,
    dto: UpdateTreatmentEvolutionDto,
  ) {
    const treatment = await this.ensureTreatment(treatmentId);
    const current = await this.ensureEvolution(treatmentId, evolutionId);
    const occurredAt = dto.occurredAt
      ? new Date(dto.occurredAt)
      : current.occurredAt;
    const nextReviewAt =
      dto.nextReviewAt !== undefined
        ? dto.nextReviewAt
          ? new Date(dto.nextReviewAt)
          : null
        : current.nextReviewAt;
    validateEvolutionDates({
      treatmentStartDate: treatment.startDate,
      occurredAt,
      nextReviewAt,
    });
    const data = {
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.title !== undefined
        ? { title: this.optionalText(dto.title) }
        : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes.trim() } : {}),
      ...(dto.weightKg !== undefined ? { weightKg: dto.weightKg } : {}),
      ...(dto.occurredAt !== undefined ? { occurredAt } : {}),
      ...(dto.nextReviewAt !== undefined ? { nextReviewAt } : {}),
    };

    const evolution = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.treatmentEvolution.update({
        where: { id: evolutionId },
        data,
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
      if (updated.status === TreatmentEvolutionStatus.RECOVERED) {
        const endDate = this.dateOnlyFromInstant(updated.occurredAt);
        await transaction.treatment.update({
          where: { id: treatmentId },
          data: {
            status: TreatmentStatus.COMPLETED,
            endDate,
            durationDays:
              Math.round(
                (endDate.getTime() - treatment.startDate.getTime()) /
                  (24 * 60 * 60_000),
              ) + 1,
          },
        });
      }
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'UPDATE',
          entityType: 'TreatmentEvolution',
          entityId: evolutionId,
          changes: this.auditChanges(data),
        },
      });
      return updated;
    });
    return this.evolutionResponse(evolution);
  }

  async removeEvolution(
    actorId: string,
    treatmentId: string,
    evolutionId: string,
  ) {
    await this.ensureEvolution(treatmentId, evolutionId);
    await this.prisma.$transaction([
      this.prisma.treatmentEvolution.update({
        where: { id: evolutionId },
        data: { deletedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'DELETE',
          entityType: 'TreatmentEvolution',
          entityId: evolutionId,
          changes: { treatmentId },
        },
      }),
    ]);
    return { success: true };
  }

  private async createAutomaticMedicalRecord(
    transaction: Prisma.TransactionClient,
    input: {
      actorId: string;
      petId: string;
      diagnosis: string;
      instructions: string;
      medications: NormalizedMedication[] | null;
      notes: string | null;
      startDate: Date;
      endDate: Date | null;
    },
  ) {
    const occurredAt = new Date(input.startDate);
    occurredAt.setUTCHours(12);
    const nextReviewAt = input.endDate
      ? new Date(input.endDate)
      : null;
    nextReviewAt?.setUTCHours(12);
    const record = await transaction.medicalRecord.create({
      data: {
        petId: input.petId,
        veterinarianId: input.actorId,
        type: 'TREATMENT',
        occurredAt,
        complaint: 'Inicio de tratamiento clínico',
        diagnosis: input.diagnosis,
        treatmentPlan: input.instructions,
        medications: this.toJsonValue(input.medications),
        notes: input.notes,
        nextReviewAt,
      },
      select: { id: true },
    });
    await transaction.auditLog.create({
      data: {
        actorId: input.actorId,
        action: 'CREATE',
        entityType: 'MedicalRecord',
        entityId: record.id,
        changes: {
          petId: input.petId,
          treatment: true,
          automatic: true,
        },
      },
    });
    return record;
  }

  private async ensurePet(petId: string) {
    const pet = await this.prisma.pet.findFirst({
      where: { id: petId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!pet) {
      throw new NotFoundException('La mascota no existe o no está activa');
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

  private async ensureTreatment(treatmentId: string) {
    const treatment = await this.prisma.treatment.findFirst({
      where: { id: treatmentId, deletedAt: null },
    });
    if (!treatment) {
      throw new NotFoundException('El tratamiento no existe');
    }
    return treatment;
  }

  private async ensureEvolution(treatmentId: string, evolutionId: string) {
    const evolution = await this.prisma.treatmentEvolution.findFirst({
      where: {
        id: evolutionId,
        treatmentId,
        deletedAt: null,
      },
    });
    if (!evolution) {
      throw new NotFoundException('El seguimiento del tratamiento no existe');
    }
    return evolution;
  }

  private validateCompletedTreatment(
    status: TreatmentStatus,
    startDate: Date,
    endDate: Date | null,
  ) {
    if (
      status === TreatmentStatus.COMPLETED &&
      !endDate &&
      startDate > todayDateOnly()
    ) {
      throw new BadRequestException(
        'No se puede finalizar un tratamiento que aún no inicia',
      );
    }
  }

  private normalizeMedications(
    medications: MedicationDto[] | null | undefined,
  ): NormalizedMedication[] | null {
    if (!medications?.length) return null;
    return medications.map((medication) => ({
      name: medication.name.trim(),
      dosage: this.optionalText(medication.dosage),
      frequency: this.optionalText(medication.frequency),
      duration: this.optionalText(medication.duration),
    }));
  }

  private toJsonValue(value: NormalizedMedication[] | null) {
    return value ?? Prisma.DbNull;
  }

  private optionalText(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private dateOnlyFromInstant(date: Date): Date {
    return new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
  }

  private auditChanges(data: Record<string, unknown>): Prisma.InputJsonObject {
    const changes: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value instanceof Date) {
        changes[key] = value.toISOString();
      } else if (value === Prisma.DbNull) {
        changes[key] = null;
      } else {
        changes[key] = value as Prisma.InputJsonValue | null;
      }
    }
    return changes;
  }

  private evolutionResponse<
    T extends { weightKg: { toNumber(): number } | null },
  >(evolution: T) {
    return {
      ...evolution,
      weightKg: evolution.weightKg?.toNumber() ?? null,
    };
  }

  private toResponse<T extends { pet: { weightKg: { toNumber(): number } | null }; evolutions?: Array<{ weightKg: { toNumber(): number } | null }> }>(
    treatment: T,
  ) {
    return {
      ...treatment,
      pet: {
        ...treatment.pet,
        weightKg: treatment.pet.weightKg?.toNumber() ?? null,
      },
      ...(treatment.evolutions
        ? {
            evolutions: treatment.evolutions.map((evolution) =>
              this.evolutionResponse(evolution),
            ),
          }
        : {}),
    };
  }
}
