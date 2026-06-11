import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from '../../security/password.service';
import { ROLE_CODES } from '../auth/authorization.constants';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  findAll() {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        roles: {
          select: {
            role: {
              select: { code: true, name: true },
            },
          },
        },
      },
    });
  }

  async create(actorId: string, dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Ya existe un usuario con ese correo');
    }

    const roles = await this.getRoles(dto.roleCodes);
    const passwordHash = await this.passwordService.hash(dto.password);

    return this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          email,
          passwordHash,
          roles: {
            createMany: {
              data: roles.map(({ id }) => ({ roleId: id })),
            },
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          status: true,
          roles: {
            select: { role: { select: { code: true, name: true } } },
          },
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'CREATE',
          entityType: 'User',
          entityId: user.id,
          changes: {
            email,
            roleCodes: roles.map(({ code }) => code),
          },
        },
      });
      return user;
    });
  }

  async updateRoles(
    actorId: string,
    userId: string,
    dto: UpdateUserRolesDto,
  ) {
    const user = await this.getUserWithRoles(userId);
    const roles = await this.getRoles(dto.roleCodes);
    const nextRoleCodes = roles.map(({ code }) => code);
    const isRemovingAdmin =
      user.roles.some(({ role }) => role.code === ROLE_CODES.ADMIN) &&
      !nextRoleCodes.includes(ROLE_CODES.ADMIN);

    if (actorId === userId && isRemovingAdmin) {
      throw new BadRequestException(
        'No puedes quitar tu propio rol de administrador',
      );
    }
    if (isRemovingAdmin) {
      await this.ensureAnotherActiveAdmin(userId);
    }

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId } }),
      this.prisma.userRole.createMany({
        data: roles.map(({ id }) => ({ userId, roleId: id })),
      }),
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'UPDATE',
          entityType: 'UserRoles',
          entityId: userId,
          changes: { roleCodes: nextRoleCodes },
        },
      }),
    ]);

    return { success: true };
  }

  async updateStatus(
    actorId: string,
    userId: string,
    dto: UpdateUserStatusDto,
  ) {
    const user = await this.getUserWithRoles(userId);
    if (actorId === userId && dto.status !== 'ACTIVE') {
      throw new BadRequestException(
        'No puedes desactivar o bloquear tu propia cuenta',
      );
    }
    if (
      dto.status !== 'ACTIVE' &&
      user.roles.some(({ role }) => role.code === ROLE_CODES.ADMIN)
    ) {
      await this.ensureAnotherActiveAdmin(userId);
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { status: dto.status },
      }),
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'UPDATE',
          entityType: 'UserStatus',
          entityId: userId,
          changes: { status: dto.status },
        },
      }),
    ]);

    return { success: true };
  }

  private async getRoles(roleCodes: string[]) {
    const uniqueCodes = [...new Set(roleCodes)];
    const roles = await this.prisma.role.findMany({
      where: { code: { in: uniqueCodes } },
      select: { id: true, code: true },
    });

    if (roles.length !== uniqueCodes.length) {
      throw new NotFoundException('Uno o más roles no existen');
    }

    return roles;
  }

  private async getUserWithRoles(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        status: true,
        roles: {
          select: { role: { select: { code: true } } },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('El usuario no existe');
    }
    return user;
  }

  private async ensureAnotherActiveAdmin(excludedUserId: string) {
    const activeAdmins = await this.prisma.user.count({
      where: {
        id: { not: excludedUserId },
        status: 'ACTIVE',
        deletedAt: null,
        roles: {
          some: { role: { code: ROLE_CODES.ADMIN } },
        },
      },
    });
    if (activeAdmins === 0) {
      throw new ConflictException(
        'Debe existir al menos un administrador activo',
      );
    }
  }
}
