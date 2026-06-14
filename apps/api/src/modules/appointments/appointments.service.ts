import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  AppointmentStatus,
  AppointmentType,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLE_CODES } from '../auth/authorization.constants';
import {
  validateAppointmentRange,
  validateAppointmentWindow,
} from './appointment-time';
import { AppointmentsQueryDto } from './dto/appointments-query.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

const INACTIVE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
];

const appointmentInclude = {
  pet: {
    select: {
      id: true,
      name: true,
      species: true,
      breed: true,
      photoPath: true,
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
      medicalRecords: { where: { deletedAt: null } },
      payments: { where: { deletedAt: null } },
    },
  },
} satisfies Prisma.AppointmentInclude;

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AppointmentsQueryDto) {
    const search = query.search?.trim();
    const range = validateAppointmentRange(query.dateFrom, query.dateTo);
    const where: Prisma.AppointmentWhereInput = {
      deletedAt: null,
      ...(query.petId ? { petId: query.petId } : {}),
      ...(query.veterinarianId
        ? { veterinarianId: query.veterinarianId }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(range.from || range.to
        ? {
            startsAt: {
              ...(range.from ? { gte: range.from } : {}),
              ...(range.to ? { lt: range.to } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { reason: { contains: search, mode: 'insensitive' } },
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
      this.prisma.appointment.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
        include: appointmentInclude,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async findOne(appointmentId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, deletedAt: null },
      include: appointmentInclude,
    });
    if (!appointment) {
      throw new NotFoundException('La cita no existe');
    }
    return appointment;
  }

  findVeterinarians() {
    return this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        roles: {
          some: {
            role: {
              code: {
                in: [ROLE_CODES.ADMIN, ROLE_CODES.VETERINARIAN],
              },
            },
          },
        },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });
  }

  async create(actorId: string, dto: CreateAppointmentDto) {
    const pet = await this.ensurePet(dto.petId);
    await this.ensureVeterinarian(dto.veterinarianId);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    const status = dto.status ?? AppointmentStatus.PENDING;
    validateAppointmentWindow(startsAt, endsAt);
    if (
      status === AppointmentStatus.COMPLETED &&
      startsAt.getTime() > Date.now() + 5 * 60_000
    ) {
      throw new BadRequestException(
        'No se puede crear como atendida una cita futura',
      );
    }
    await this.ensureAvailability({
      petId: pet.id,
      veterinarianId: dto.veterinarianId ?? null,
      startsAt,
      endsAt,
      status,
    });

    return this.prisma.$transaction(async (transaction) => {
      const appointment = await transaction.appointment.create({
        data: {
          petId: pet.id,
          ownerId: pet.ownerId,
          veterinarianId: dto.veterinarianId ?? null,
          type: dto.type,
          status,
          startsAt,
          endsAt,
          reason: this.optionalText(dto.reason),
          notes: this.optionalText(dto.notes),
        },
        include: appointmentInclude,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'CREATE',
          entityType: 'Appointment',
          entityId: appointment.id,
          changes: {
            petId: appointment.petId,
            veterinarianId: appointment.veterinarianId,
            type: appointment.type,
            status: appointment.status,
            startsAt: appointment.startsAt.toISOString(),
            endsAt: appointment.endsAt.toISOString(),
          },
        },
      });
      return appointment;
    });
  }

  async update(
    actorId: string,
    appointmentId: string,
    dto: UpdateAppointmentDto,
  ) {
    const current = await this.ensureAppointment(appointmentId);
    const pet = dto.petId
      ? await this.ensurePet(dto.petId)
      : { id: current.petId, ownerId: current.ownerId };
    if (dto.veterinarianId !== undefined) {
      await this.ensureVeterinarian(dto.veterinarianId);
    }

    const startsAt = dto.startsAt
      ? new Date(dto.startsAt)
      : current.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : current.endsAt;
    const veterinarianId =
      dto.veterinarianId !== undefined
        ? dto.veterinarianId
        : current.veterinarianId;
    const status = dto.status ?? current.status;
    validateAppointmentWindow(startsAt, endsAt, { allowPast: true });
    if (
      status === AppointmentStatus.COMPLETED &&
      startsAt.getTime() > Date.now() + 5 * 60_000
    ) {
      throw new BadRequestException(
        'No se puede marcar como atendida una cita futura',
      );
    }
    await this.ensureAvailability({
      appointmentId,
      petId: pet.id,
      veterinarianId,
      startsAt,
      endsAt,
      status,
    });

    const data = {
      ...(dto.petId !== undefined
        ? { petId: pet.id, ownerId: pet.ownerId }
        : {}),
      ...(dto.veterinarianId !== undefined ? { veterinarianId } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.startsAt !== undefined ? { startsAt } : {}),
      ...(dto.endsAt !== undefined ? { endsAt } : {}),
      ...(dto.reason !== undefined
        ? { reason: this.optionalText(dto.reason) }
        : {}),
      ...(dto.notes !== undefined ? { notes: this.optionalText(dto.notes) } : {}),
    };

    return this.prisma.$transaction(async (transaction) => {
      const appointment = await transaction.appointment.update({
        where: { id: appointmentId },
        data,
        include: appointmentInclude,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'UPDATE',
          entityType: 'Appointment',
          entityId: appointmentId,
          changes: this.auditChanges(data),
        },
      });
      return appointment;
    });
  }

  async updateStatus(
    actorId: string,
    appointmentId: string,
    dto: UpdateAppointmentStatusDto,
  ) {
    const current = await this.ensureAppointment(appointmentId);
    if (
      dto.status === AppointmentStatus.COMPLETED &&
      current.startsAt.getTime() > Date.now() + 5 * 60_000
    ) {
      throw new BadRequestException(
        'No se puede marcar como atendida una cita futura',
      );
    }
    if (!INACTIVE_STATUSES.includes(dto.status)) {
      await this.ensureAvailability({
        appointmentId,
        petId: current.petId,
        veterinarianId: current.veterinarianId,
        startsAt: current.startsAt,
        endsAt: current.endsAt,
        status: dto.status,
      });
    }

    return this.prisma.$transaction(async (transaction) => {
      const appointment = await transaction.appointment.update({
        where: { id: appointmentId },
        data: { status: dto.status },
        include: appointmentInclude,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'UPDATE',
          entityType: 'AppointmentStatus',
          entityId: appointmentId,
          changes: { from: current.status, to: dto.status },
        },
      });
      return appointment;
    });
  }

  async remove(actorId: string, appointmentId: string) {
    await this.ensureAppointment(appointmentId);
    const links = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        _count: {
          select: {
            medicalRecords: { where: { deletedAt: null } },
            payments: { where: { deletedAt: null } },
          },
        },
      },
    });
    if (
      links &&
      (links._count.medicalRecords > 0 || links._count.payments > 0)
    ) {
      throw new ConflictException(
        'No se puede archivar una cita con historial clínico o pagos vinculados',
      );
    }

    await this.prisma.$transaction([
      this.prisma.appointment.update({
        where: { id: appointmentId },
        data: { deletedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'DELETE',
          entityType: 'Appointment',
          entityId: appointmentId,
        },
      }),
    ]);
    return { success: true };
  }

  private async ensureAvailability(input: {
    appointmentId?: string;
    petId: string;
    veterinarianId: string | null;
    startsAt: Date;
    endsAt: Date;
    status: AppointmentStatus;
  }) {
    if (INACTIVE_STATUSES.includes(input.status)) return;

    const overlap: Prisma.AppointmentWhereInput = {
      id: input.appointmentId ? { not: input.appointmentId } : undefined,
      deletedAt: null,
      status: { notIn: INACTIVE_STATUSES },
      startsAt: { lt: input.endsAt },
      endsAt: { gt: input.startsAt },
    };
    const petConflict = await this.prisma.appointment.findFirst({
      where: { ...overlap, petId: input.petId },
      select: { id: true },
    });
    if (petConflict) {
      throw new ConflictException(
        'La mascota ya tiene una cita en ese horario',
      );
    }

    if (input.veterinarianId) {
      const veterinarianConflict = await this.prisma.appointment.findFirst({
        where: {
          ...overlap,
          veterinarianId: input.veterinarianId,
        },
        select: { id: true },
      });
      if (veterinarianConflict) {
        throw new ConflictException(
          'El veterinario ya tiene una cita en ese horario',
        );
      }
    }
  }

  private async ensurePet(petId: string) {
    const pet = await this.prisma.pet.findFirst({
      where: { id: petId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, ownerId: true },
    });
    if (!pet) {
      throw new NotFoundException('La mascota no existe o no está activa');
    }
    return pet;
  }

  private async ensureVeterinarian(veterinarianId?: string | null) {
    if (!veterinarianId) return;
    const veterinarian = await this.prisma.user.findFirst({
      where: {
        id: veterinarianId,
        status: 'ACTIVE',
        deletedAt: null,
        roles: {
          some: {
            role: {
              code: {
                in: [ROLE_CODES.ADMIN, ROLE_CODES.VETERINARIAN],
              },
            },
          },
        },
      },
      select: { id: true },
    });
    if (!veterinarian) {
      throw new NotFoundException(
        'El veterinario no existe o no está disponible',
      );
    }
  }

  private async ensureAppointment(appointmentId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, deletedAt: null },
    });
    if (!appointment) {
      throw new NotFoundException('La cita no existe');
    }
    return appointment;
  }

  private optionalText(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private auditChanges(data: Record<string, unknown>): Prisma.InputJsonObject {
    const changes: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [key, value] of Object.entries(data)) {
      changes[key] =
        value instanceof Date
          ? value.toISOString()
          : (value as Prisma.InputJsonValue | null);
    }
    return changes as Prisma.InputJsonObject;
  }
}
