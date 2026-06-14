import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVaccineDto } from './dto/create-vaccine.dto';
import { PreventiveCareQueryDto } from './dto/preventive-care-query.dto';
import { UpdateVaccineDto } from './dto/update-vaccine.dto';
import {
  daysUntil,
  getPreventiveCareStatus,
  parseDateOnly,
  preventiveStatusWhere,
} from './preventive-care-status';
import { PreventiveCareSupportService } from './preventive-care-support.service';

const vaccineInclude = {
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
export class VaccinesService {
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
            { name: { contains: search, mode: 'insensitive' as const } },
            {
              manufacturer: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
            {
              batchNumber: {
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
      this.prisma.vaccine.findMany({
        where,
        include: vaccineInclude,
        orderBy: [{ appliedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: query.pageSize,
      }),
      this.prisma.vaccine.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async create(actorId: string, dto: CreateVaccineDto) {
    await this.support.ensurePet(dto.petId);
    if (dto.medicalRecordId) {
      await this.support.ensureMedicalRecord(dto.medicalRecordId, dto.petId);
    }
    const dates = this.support.validateDates(
      dto.appliedAt,
      dto.nextDueDate,
    );
    const notes = this.support.optionalText(dto.notes);

    const vaccine = await this.prisma.$transaction(async (transaction) => {
      const recordId =
        dto.medicalRecordId ??
        (
          await this.support.createAutomaticRecord(transaction, {
            actorId,
            petId: dto.petId,
            kind: 'VACCINE',
            name: dto.name.trim(),
            ...dates,
            notes,
          })
        ).id;
      const created = await transaction.vaccine.create({
        data: {
          petId: dto.petId,
          medicalRecordId: recordId,
          veterinarianId: actorId,
          name: dto.name.trim(),
          manufacturer: this.support.optionalText(dto.manufacturer),
          batchNumber: this.support.optionalText(dto.batchNumber),
          ...dates,
          status: 'APPLIED',
          notes,
        },
        include: vaccineInclude,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'CREATE',
          entityType: 'Vaccine',
          entityId: created.id,
          changes: {
            petId: created.petId,
            name: created.name,
            appliedAt: created.appliedAt.toISOString(),
            nextDueDate: created.nextDueDate?.toISOString() ?? null,
          },
        },
      });
      return created;
    });
    return this.toResponse(vaccine);
  }

  async update(actorId: string, vaccineId: string, dto: UpdateVaccineDto) {
    const current = await this.ensureVaccine(vaccineId);
    const appliedValue =
      dto.appliedAt ?? current.appliedAt.toISOString().slice(0, 10);
    const dueValue =
      dto.nextDueDate !== undefined
        ? dto.nextDueDate
        : current.nextDueDate?.toISOString().slice(0, 10);
    const dates = this.support.validateDates(appliedValue, dueValue);
    const data = {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.manufacturer !== undefined
        ? { manufacturer: this.support.optionalText(dto.manufacturer) }
        : {}),
      ...(dto.batchNumber !== undefined
        ? { batchNumber: this.support.optionalText(dto.batchNumber) }
        : {}),
      ...(dto.appliedAt !== undefined ? { appliedAt: dates.appliedAt } : {}),
      ...(dto.nextDueDate !== undefined
        ? { nextDueDate: dates.nextDueDate }
        : {}),
      ...(dto.notes !== undefined
        ? { notes: this.support.optionalText(dto.notes) }
        : {}),
    };
    const vaccine = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.vaccine.update({
        where: { id: vaccineId },
        data,
        include: vaccineInclude,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'UPDATE',
          entityType: 'Vaccine',
          entityId: vaccineId,
          changes: this.support.auditChanges(data),
        },
      });
      return updated;
    });
    return this.toResponse(vaccine);
  }

  async remove(actorId: string, vaccineId: string) {
    await this.ensureVaccine(vaccineId);
    await this.prisma.$transaction([
      this.prisma.vaccine.update({
        where: { id: vaccineId },
        data: { deletedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'DELETE',
          entityType: 'Vaccine',
          entityId: vaccineId,
        },
      }),
    ]);
    return { success: true };
  }

  private async ensureVaccine(vaccineId: string) {
    const vaccine = await this.prisma.vaccine.findFirst({
      where: { id: vaccineId, deletedAt: null },
    });
    if (!vaccine) {
      throw new NotFoundException('El registro de vacunación no existe');
    }
    return vaccine;
  }

  private toResponse<T extends { nextDueDate: Date | null }>(vaccine: T) {
    return {
      ...vaccine,
      status: getPreventiveCareStatus(vaccine.nextDueDate),
      daysRemaining: daysUntil(vaccine.nextDueDate),
    };
  }
}
