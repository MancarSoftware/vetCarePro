import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from '../../security/password.service';
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

  async create(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Ya existe un usuario con ese correo');
    }

    const roles = await this.getRoles(dto.roleCodes);
    const passwordHash = await this.passwordService.hash(dto.password);

    return this.prisma.user.create({
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
  }

  async updateRoles(userId: string, dto: UpdateUserRolesDto) {
    await this.ensureUser(userId);
    const roles = await this.getRoles(dto.roleCodes);

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId } }),
      this.prisma.userRole.createMany({
        data: roles.map(({ id }) => ({ userId, roleId: id })),
      }),
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { success: true };
  }

  async updateStatus(userId: string, dto: UpdateUserStatusDto) {
    await this.ensureUser(userId);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { status: dto.status },
      }),
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
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

  private async ensureUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('El usuario no existe');
    }
  }
}

