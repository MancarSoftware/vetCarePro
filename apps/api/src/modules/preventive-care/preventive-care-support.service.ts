import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  addUtcDays,
  parseDateOnly,
  todayDateOnly,
} from './preventive-care-status';

@Injectable()
export class PreventiveCareSupportService {
  constructor(private readonly prisma: PrismaService) {}

  async ensurePet(petId: string) {
    const pet = await this.prisma.pet.findFirst({
      where: { id: petId, deletedAt: null },
      select: {
        id: true,
        name: true,
        weightKg: true,
      },
    });
    if (!pet) {
      throw new NotFoundException('La mascota no existe');
    }
    return pet;
  }

  async ensureMedicalRecord(recordId: string, petId: string) {
    const record = await this.prisma.medicalRecord.findFirst({
      where: { id: recordId, petId, deletedAt: null },
      select: { id: true },
    });
    if (!record) {
      throw new NotFoundException(
        'La entrada clínica no existe o pertenece a otra mascota',
      );
    }
    return record;
  }

  validateDates(appliedAtValue: string, nextDueDateValue?: string | null) {
    const appliedAt = parseDateOnly(appliedAtValue);
    const nextDueDate = nextDueDateValue
      ? parseDateOnly(nextDueDateValue)
      : null;
    if (appliedAt > todayDateOnly()) {
      throw new BadRequestException(
        'La fecha de aplicación no puede estar en el futuro',
      );
    }
    if (nextDueDate && nextDueDate <= appliedAt) {
      throw new BadRequestException(
        'La próxima dosis debe ser posterior a la fecha de aplicación',
      );
    }
    return { appliedAt, nextDueDate };
  }

  async createAutomaticRecord(
    transaction: Prisma.TransactionClient,
    input: {
      actorId: string;
      petId: string;
      kind: 'VACCINE' | 'DEWORMING';
      name: string;
      appliedAt: Date;
      nextDueDate: Date | null;
      notes: string | null;
    },
  ) {
    const occurredAt = new Date(input.appliedAt);
    occurredAt.setUTCHours(12);
    const nextReviewAt = input.nextDueDate
      ? addUtcDays(input.nextDueDate, 0)
      : null;
    nextReviewAt?.setUTCHours(12);
    const vaccine = input.kind === 'VACCINE';

    const record = await transaction.medicalRecord.create({
      data: {
        petId: input.petId,
        veterinarianId: input.actorId,
        type: vaccine ? 'VACCINATION' : 'OTHER',
        occurredAt,
        complaint: vaccine
          ? `Vacuna aplicada: ${input.name}`
          : `Desparasitación: ${input.name}`,
        treatmentPlan: vaccine
          ? 'Aplicación preventiva registrada'
          : 'Desparasitación preventiva registrada',
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
          preventiveCare: input.kind,
          automatic: true,
        },
      },
    });
    return record;
  }

  optionalText(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  auditChanges(data: Record<string, unknown>): Prisma.InputJsonObject {
    const changes: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [key, value] of Object.entries(data)) {
      changes[key] =
        value instanceof Date
          ? value.toISOString()
          : (value as Prisma.InputJsonValue | null);
    }
    return changes;
  }
}
