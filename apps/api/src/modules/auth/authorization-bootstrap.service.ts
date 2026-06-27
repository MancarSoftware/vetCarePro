import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS, ROLE_CODES } from './authorization.constants';

const permissionDescriptions: Record<string, string> = {
  [PERMISSIONS.DASHBOARD_READ]: 'Ver el dashboard',
  [PERMISSIONS.USERS_READ]: 'Ver usuarios y roles',
  [PERMISSIONS.USERS_MANAGE]: 'Crear y administrar usuarios',
  [PERMISSIONS.OWNERS_READ]: 'Ver dueños',
  [PERMISSIONS.OWNERS_MANAGE]: 'Administrar dueños',
  [PERMISSIONS.PETS_READ]: 'Ver mascotas',
  [PERMISSIONS.PETS_MANAGE]: 'Administrar mascotas',
  [PERMISSIONS.APPOINTMENTS_READ]: 'Ver citas',
  [PERMISSIONS.APPOINTMENTS_MANAGE]: 'Administrar citas',
  [PERMISSIONS.MEDICAL_READ]: 'Ver historiales clínicos',
  [PERMISSIONS.MEDICAL_MANAGE]: 'Administrar historiales clínicos',
  [PERMISSIONS.VACCINES_READ]: 'Ver vacunas',
  [PERMISSIONS.VACCINES_MANAGE]: 'Administrar vacunas',
  [PERMISSIONS.TREATMENTS_READ]: 'Ver tratamientos',
  [PERMISSIONS.TREATMENTS_MANAGE]: 'Administrar tratamientos',
  [PERMISSIONS.INVENTORY_READ]: 'Ver inventario',
  [PERMISSIONS.INVENTORY_MANAGE]: 'Administrar inventario',
  [PERMISSIONS.PAYMENTS_READ]: 'Ver pagos',
  [PERMISSIONS.PAYMENTS_MANAGE]: 'Administrar pagos',
  [PERMISSIONS.FINANCE_READ]: 'Ver finanzas y rentabilidad',
  [PERMISSIONS.FINANCE_MANAGE]: 'Registrar y administrar gastos',
  [PERMISSIONS.REPORTS_READ]: 'Ver reportes',
  [PERMISSIONS.SETTINGS_MANAGE]: 'Administrar configuración',
  [PERMISSIONS.BACKUPS_MANAGE]: 'Administrar backups',
  [PERMISSIONS.AUDIT_READ]: 'Ver auditoría',
};

const roleDefinitions = [
  {
    code: ROLE_CODES.ADMIN,
    name: 'Administrador',
    description: 'Acceso completo al sistema',
    permissions: Object.values(PERMISSIONS),
  },
  {
    code: ROLE_CODES.VETERINARIAN,
    name: 'Veterinario',
    description: 'Atención clínica y seguimiento de pacientes',
    permissions: [
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.OWNERS_READ,
      PERMISSIONS.PETS_READ,
      PERMISSIONS.PETS_MANAGE,
      PERMISSIONS.APPOINTMENTS_READ,
      PERMISSIONS.APPOINTMENTS_MANAGE,
      PERMISSIONS.MEDICAL_READ,
      PERMISSIONS.MEDICAL_MANAGE,
      PERMISSIONS.VACCINES_READ,
      PERMISSIONS.VACCINES_MANAGE,
      PERMISSIONS.TREATMENTS_READ,
      PERMISSIONS.TREATMENTS_MANAGE,
      PERMISSIONS.INVENTORY_READ,
    ],
  },
  {
    code: ROLE_CODES.RECEPTION,
    name: 'Recepción',
    description: 'Registro de clientes, pacientes y agenda',
    permissions: [
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.OWNERS_READ,
      PERMISSIONS.OWNERS_MANAGE,
      PERMISSIONS.PETS_READ,
      PERMISSIONS.PETS_MANAGE,
      PERMISSIONS.APPOINTMENTS_READ,
      PERMISSIONS.APPOINTMENTS_MANAGE,
      PERMISSIONS.PAYMENTS_READ,
    ],
  },
  {
    code: ROLE_CODES.CASHIER,
    name: 'Caja',
    description: 'Pagos, ventas e inventario',
    permissions: [
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.OWNERS_READ,
      PERMISSIONS.PETS_READ,
      PERMISSIONS.APPOINTMENTS_READ,
      PERMISSIONS.PAYMENTS_READ,
      PERMISSIONS.PAYMENTS_MANAGE,
      PERMISSIONS.FINANCE_READ,
      PERMISSIONS.FINANCE_MANAGE,
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.INVENTORY_MANAGE,
      PERMISSIONS.REPORTS_READ,
    ],
  },
];

@Injectable()
export class AuthorizationBootstrapService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    for (const [code, description] of Object.entries(
      permissionDescriptions,
    )) {
      await this.prisma.permission.upsert({
        where: { code },
        update: { description },
        create: { code, description },
      });
    }

    for (const definition of roleDefinitions) {
      const role = await this.prisma.role.upsert({
        where: { code: definition.code },
        update: {
          name: definition.name,
          description: definition.description,
        },
        create: {
          code: definition.code,
          name: definition.name,
          description: definition.description,
        },
      });
      const permissions = await this.prisma.permission.findMany({
        where: { code: { in: definition.permissions } },
        select: { id: true },
      });

      await this.prisma.$transaction([
        this.prisma.rolePermission.deleteMany({
          where: { roleId: role.id },
        }),
        this.prisma.rolePermission.createMany({
          data: permissions.map(({ id }) => ({
            roleId: role.id,
            permissionId: id,
          })),
          skipDuplicates: true,
        }),
      ]);
    }
  }
}
