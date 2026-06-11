import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        permissions: {
          select: {
            permission: {
              select: { code: true, description: true },
            },
          },
        },
      },
    });
  }
}

