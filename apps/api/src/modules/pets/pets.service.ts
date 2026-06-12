import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { PetsQueryDto } from './dto/pets-query.dto';
import { UpdatePetDto } from './dto/update-pet.dto';

@Injectable()
export class PetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PetsQueryDto) {
    const search = query.search?.trim();
    const where = {
      deletedAt: null,
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.species
        ? {
            species: {
              equals: query.species.trim(),
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { species: { contains: search, mode: 'insensitive' as const } },
              { breed: { contains: search, mode: 'insensitive' as const } },
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
                    {
                      nationalId: {
                        contains: search,
                        mode: 'insensitive' as const,
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
      this.prisma.pet.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
      }),
      this.prisma.pet.count({ where }),
    ]);

    return {
      items: items.map((pet) => ({
        ...pet,
        weightKg: pet.weightKg?.toNumber() ?? null,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async findOne(petId: string) {
    const pet = await this.prisma.pet.findFirst({
      where: { id: petId, deletedAt: null },
      include: {
        owner: true,
        _count: {
          select: {
            appointments: true,
            medicalRecords: true,
            treatments: true,
            vaccines: true,
            mediaFiles: true,
          },
        },
      },
    });
    if (!pet) {
      throw new NotFoundException('La mascota no existe');
    }
    return {
      ...pet,
      weightKg: pet.weightKg?.toNumber() ?? null,
    };
  }

  async create(actorId: string, dto: CreatePetDto) {
    await this.ensureOwner(dto.ownerId);
    const data = this.normalizePet(dto);

    return this.prisma.$transaction(async (transaction) => {
      const pet = await transaction.pet.create({ data });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'CREATE',
          entityType: 'Pet',
          entityId: pet.id,
          changes: {
            name: pet.name,
            ownerId: pet.ownerId,
            species: pet.species,
          },
        },
      });
      return {
        ...pet,
        weightKg: pet.weightKg?.toNumber() ?? null,
      };
    });
  }

  async update(actorId: string, petId: string, dto: UpdatePetDto) {
    await this.ensurePet(petId);
    if (dto.ownerId) {
      await this.ensureOwner(dto.ownerId);
    }
    const data = this.normalizePartialPet(dto);

    return this.prisma.$transaction(async (transaction) => {
      const pet = await transaction.pet.update({
        where: { id: petId },
        data,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'UPDATE',
          entityType: 'Pet',
          entityId: petId,
          changes: data,
        },
      });
      return {
        ...pet,
        weightKg: pet.weightKg?.toNumber() ?? null,
      };
    });
  }

  async remove(actorId: string, petId: string) {
    await this.ensurePet(petId);
    await this.prisma.$transaction([
      this.prisma.pet.update({
        where: { id: petId },
        data: { deletedAt: new Date(), status: 'INACTIVE' },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'DELETE',
          entityType: 'Pet',
          entityId: petId,
        },
      }),
    ]);
    return { success: true };
  }

  private async ensureOwner(ownerId: string) {
    const owner = await this.prisma.owner.findFirst({
      where: { id: ownerId, deletedAt: null },
      select: { id: true },
    });
    if (!owner) {
      throw new NotFoundException('El dueño no existe');
    }
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

  private normalizePet(dto: CreatePetDto) {
    return {
      ownerId: dto.ownerId,
      name: dto.name.trim(),
      species: dto.species.trim(),
      breed: this.optionalText(dto.breed),
      sex: dto.sex,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
      approximateAgeMonths: dto.approximateAgeMonths ?? null,
      weightKg: dto.weightKg ?? null,
      color: this.optionalText(dto.color),
      status: dto.status ?? 'ACTIVE',
      notes: this.optionalText(dto.notes),
    };
  }

  private normalizePartialPet(dto: UpdatePetDto) {
    return {
      ...(dto.ownerId !== undefined ? { ownerId: dto.ownerId } : {}),
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.species !== undefined ? { species: dto.species.trim() } : {}),
      ...(dto.breed !== undefined
        ? { breed: this.optionalText(dto.breed) }
        : {}),
      ...(dto.sex !== undefined ? { sex: dto.sex } : {}),
      ...(dto.birthDate !== undefined
        ? { birthDate: dto.birthDate ? new Date(dto.birthDate) : null }
        : {}),
      ...(dto.approximateAgeMonths !== undefined
        ? { approximateAgeMonths: dto.approximateAgeMonths }
        : {}),
      ...(dto.weightKg !== undefined ? { weightKg: dto.weightKg } : {}),
      ...(dto.color !== undefined
        ? { color: this.optionalText(dto.color) }
        : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
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

