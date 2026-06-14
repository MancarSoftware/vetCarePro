import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDewormingDto } from './dto/create-deworming.dto';
import { PreventiveCareQueryDto } from './dto/preventive-care-query.dto';
import { UpdateDewormingDto } from './dto/update-deworming.dto';
import {
  daysUntil,
  getPreventiveCareStatus,
  parseDateOnly,
  preventiveStatusWhere,
} from './preventive-care-status';
import { PreventiveCareSupportService } from './preventive-care-support.service';

const dewormingInclude = {
  pet: {
    select: {
      id: true,
      name: true,
      species: true,
      breed: true,
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
} as const;

@Injectable()
export class DewormingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: PreventiveCareSupportService,
  ) {}

  async findAll(query: PreventiveCareQueryDto) {
    const search = query.search?.trim();
    const statusWhere = preventiveStatusWhere(query.status);
    const searchWhere = search
      ? {
          OR: [
            {
              medication: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
            { dosage: { contains: search, mode: 'insensitive' as const } },
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
      : {};
    const where = {
      deletedAt: null,
      pet: { deletedAt: null },
      ...(query.petId ? { petId: query.petId } : {}),
      AND: [statusWhere, searchWhere],
      ...(query.dateFrom || query.dateTo
        ? {
            appliedAt: {
              ...(query.dateFrom
                ? { gte: parseDateOnly(query.dateFrom) }
                : {}),
              ...(query.dateTo ? { lte: parseDateOnly(query.dateTo) } : {}),
            },
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.deworming.findMany({
        where,
        include: dewormingInclude,
        orderBy: [{ appliedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: query.pageSize,
      }),
      this.prisma.deworming.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async create(actorId: string, dto: CreateDewormingDto) {
    const pet = await this.support.ensurePet(dto.petId);
    if (dto.medicalRecordId) {
      await this.support.ensureMedicalRecord(dto.medicalRecordId, dto.petId);
    }
    const dates = this.support.validateDates(
      dto.appliedAt,
      dto.nextDueDate,
    );
    const notes = this.support.optionalText(dto.notes);
    const weightKg = dto.weightKg ?? pet.weightKg?.toNumber() ?? null;

    const deworming = await this.prisma.$transaction(
      async (transaction) => {
        const recordId =
          dto.medicalRecordId ??
          (
            await this.support.createAutomaticRecord(transaction, {
              actorId,
              petId: dto.petId,
              kind: 'DEWORMING',
              name: dto.medication.trim(),
              ...dates,
              notes,
            })
          ).id;
        const created = await transaction.deworming.create({
          data: {
            petId: dto.petId,
            medicalRecordId: recordId,
            veterinarianId: actorId,
            medication: dto.medication.trim(),
            ...dates,
            weightKg,
            dosage: this.support.optionalText(dto.dosage),
            status: 'APPLIED',
            notes,
          },
          include: dewormingInclude,
        });
        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'CREATE',
            entityType: 'Deworming',
            entityId: created.id,
            changes: {
              petId: created.petId,
              medication: created.medication,
              appliedAt: created.appliedAt.toISOString(),
              nextDueDate: created.nextDueDate?.toISOString() ?? null,
              weightKg: created.weightKg?.toNumber() ?? null,
            },
          },
        });
        return created;
      },
    );
    return this.toResponse(deworming);
  }

  async update(
    actorId: string,
    dewormingId: string,
    dto: UpdateDewormingDto,
  ) {
    const current = await this.ensureDeworming(dewormingId);
    const appliedValue =
      dto.appliedAt ?? current.appliedAt.toISOString().slice(0, 10);
    const dueValue =
      dto.nextDueDate !== undefined
        ? dto.nextDueDate
        : current.nextDueDate?.toISOString().slice(0, 10);
    const dates = this.support.validateDates(appliedValue, dueValue);
    const data = {
      ...(dto.medication !== undefined
        ? { medication: dto.medication.trim() }
        : {}),
      ...(dto.appliedAt !== undefined ? { appliedAt: dates.appliedAt } : {}),
      ...(dto.nextDueDate !== undefined
        ? { nextDueDate: dates.nextDueDate }
        : {}),
      ...(dto.weightKg !== undefined ? { weightKg: dto.weightKg } : {}),
      ...(dto.dosage !== undefined
        ? { dosage: this.support.optionalText(dto.dosage) }
        : {}),
      ...(dto.notes !== undefined
        ? { notes: this.support.optionalText(dto.notes) }
        : {}),
    };
    const deworming = await this.prisma.$transaction(
      async (transaction) => {
        const updated = await transaction.deworming.update({
          where: { id: dewormingId },
          data,
          include: dewormingInclude,
        });
        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'UPDATE',
            entityType: 'Deworming',
            entityId: dewormingId,
            changes: this.support.auditChanges(data),
          },
        });
        return updated;
      },
    );
    return this.toResponse(deworming);
  }

  async remove(actorId: string, dewormingId: string) {
    await this.ensureDeworming(dewormingId);
    await this.prisma.$transaction([
      this.prisma.deworming.update({
        where: { id: dewormingId },
        data: { deletedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'DELETE',
          entityType: 'Deworming',
          entityId: dewormingId,
        },
      }),
    ]);
    return { success: true };
  }

  private async ensureDeworming(dewormingId: string) {
    const deworming = await this.prisma.deworming.findFirst({
      where: { id: dewormingId, deletedAt: null },
    });
    if (!deworming) {
      throw new NotFoundException(
        'El registro de desparasitación no existe',
      );
    }
    return deworming;
  }

  private toResponse<
    T extends {
      nextDueDate: Date | null;
      weightKg: { toNumber(): number } | null;
    },
  >(deworming: T) {
    return {
      ...deworming,
      weightKg: deworming.weightKg?.toNumber() ?? null,
      status: getPreventiveCareStatus(deworming.nextDueDate),
      daysRemaining: daysUntil(deworming.nextDueDate),
    };
  }
}
