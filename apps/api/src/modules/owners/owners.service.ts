import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOwnerDto } from './dto/create-owner.dto';
import { OwnersQueryDto } from './dto/owners-query.dto';
import { UpdateOwnerDto } from './dto/update-owner.dto';

@Injectable()
export class OwnersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: OwnersQueryDto) {
    const search = query.search?.trim();
    const where = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' as const } },
              { lastName: { contains: search, mode: 'insensitive' as const } },
              { nationalId: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              {
                pets: {
                  some: {
                    name: { contains: search, mode: 'insensitive' as const },
                    deletedAt: null,
                  },
                },
              },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.owner.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          nationalId: true,
          phone: true,
          email: true,
          address: true,
          notes: true,
          registeredAt: true,
          createdAt: true,
          updatedAt: true,
          pets: {
            where: { deletedAt: null },
            orderBy: { name: 'asc' },
            select: {
              id: true,
              name: true,
              species: true,
              breed: true,
              status: true,
            },
          },
          _count: {
            select: {
              pets: { where: { deletedAt: null } },
            },
          },
        },
      }),
      this.prisma.owner.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async findOne(ownerId: string) {
    const owner = await this.prisma.owner.findFirst({
      where: { id: ownerId, deletedAt: null },
      include: {
        pets: {
          where: { deletedAt: null },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!owner) {
      throw new NotFoundException('El dueño no existe');
    }
    return owner;
  }

  async create(actorId: string, dto: CreateOwnerDto) {
    const data = this.normalizeOwner(dto);
    await this.ensureNationalIdAvailable(data.nationalId);

    return this.prisma.$transaction(async (transaction) => {
      const owner = await transaction.owner.create({ data });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'CREATE',
          entityType: 'Owner',
          entityId: owner.id,
          changes: {
            name: `${owner.firstName} ${owner.lastName}`,
            nationalId: owner.nationalId,
          },
        },
      });
      return owner;
    });
  }

  async update(actorId: string, ownerId: string, dto: UpdateOwnerDto) {
    const current = await this.ensureOwner(ownerId);
    const data = this.normalizePartialOwner(dto);
    if (
      data.nationalId !== undefined &&
      data.nationalId !== current.nationalId
    ) {
      await this.ensureNationalIdAvailable(data.nationalId, ownerId);
    }

    return this.prisma.$transaction(async (transaction) => {
      const owner = await transaction.owner.update({
        where: { id: ownerId },
        data,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'UPDATE',
          entityType: 'Owner',
          entityId: ownerId,
          changes: data,
        },
      });
      return owner;
    });
  }

  async remove(actorId: string, ownerId: string) {
    await this.ensureOwner(ownerId);
    const pets = await this.prisma.pet.count({
      where: { ownerId, deletedAt: null },
    });
    if (pets > 0) {
      throw new ConflictException(
        'No se puede archivar un dueño que todavía tiene mascotas registradas',
      );
    }

    await this.prisma.$transaction([
      this.prisma.owner.update({
        where: { id: ownerId },
        data: { deletedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'DELETE',
          entityType: 'Owner',
          entityId: ownerId,
        },
      }),
    ]);
    return { success: true };
  }

  private async ensureOwner(ownerId: string) {
    const owner = await this.prisma.owner.findFirst({
      where: { id: ownerId, deletedAt: null },
    });
    if (!owner) {
      throw new NotFoundException('El dueño no existe');
    }
    return owner;
  }

  private async ensureNationalIdAvailable(
    nationalId: string | null | undefined,
    excludedOwnerId?: string,
  ) {
    if (!nationalId) return;
    const existing = await this.prisma.owner.findFirst({
      where: {
        nationalId,
        id: excludedOwnerId ? { not: excludedOwnerId } : undefined,
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Ya existe un dueño con esa cédula o identificación',
      );
    }
  }

  private normalizeOwner(dto: CreateOwnerDto) {
    return {
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      nationalId: this.optionalText(dto.nationalId),
      phone: dto.phone.trim(),
      email: this.optionalText(dto.email)?.toLowerCase(),
      address: this.optionalText(dto.address),
      notes: this.optionalText(dto.notes),
    };
  }

  private normalizePartialOwner(dto: UpdateOwnerDto) {
    return {
      ...(dto.firstName !== undefined
        ? { firstName: dto.firstName.trim() }
        : {}),
      ...(dto.lastName !== undefined
        ? { lastName: dto.lastName.trim() }
        : {}),
      ...(dto.nationalId !== undefined
        ? { nationalId: this.optionalText(dto.nationalId) }
        : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
      ...(dto.email !== undefined
        ? { email: this.optionalText(dto.email)?.toLowerCase() ?? null }
        : {}),
      ...(dto.address !== undefined
        ? { address: this.optionalText(dto.address) }
        : {}),
      ...(dto.notes !== undefined
        ? { notes: this.optionalText(dto.notes) }
        : {}),
    };
  }

  private optionalText(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }
}

