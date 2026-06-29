import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivateLanLicenseDto } from './dto/activate-lan-license.dto';
import { RegisterLanDeviceDto } from './dto/register-lan-device.dto';
import {
  DEFAULT_LICENSE_SECRET,
  verifyLanLicenseKey,
  type LanLicensePayload,
} from './lan-license.crypto';

const DEFAULT_SUPPORT_CODE = 'VCP-SOPORTE-110';

@Injectable()
export class LanLicenseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getStatus() {
    const license = await this.activeLicense();
    if (!license) {
      return {
        required: this.isLanServer(),
        active: false,
        message: this.isLanServer()
          ? 'El Servidor LAN necesita una licencia LAN activa.'
          : 'La licencia LAN solo se aplica en modo Servidor LAN.',
        license: null,
        devices: [],
        clientLimit: 0,
        usedClients: 0,
        remainingClients: 0,
      };
    }

    const devices = await this.prisma.lanDevice.findMany({
      where: { licenseId: license.id, revokedAt: null },
      orderBy: { firstSeenAt: 'asc' },
    });

    return {
      required: this.isLanServer(),
      active: true,
      message: 'Licencia LAN activa.',
      license: {
        id: license.licenseId,
        clinicName: license.clinicName,
        clientLimit: license.clientLimit,
        issuedAt: license.issuedAt.toISOString(),
        expiresAt: license.expiresAt?.toISOString() ?? null,
        activatedAt: license.activatedAt.toISOString(),
      },
      devices: devices.map((device) => ({
        id: device.id,
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        runtimeMode: device.runtimeMode,
        firstSeenAt: device.firstSeenAt.toISOString(),
        lastSeenAt: device.lastSeenAt.toISOString(),
      })),
      clientLimit: license.clientLimit,
      usedClients: devices.length,
      remainingClients: Math.max(license.clientLimit - devices.length, 0),
    };
  }

  async activate(dto: ActivateLanLicenseDto) {
    this.assertSupportCode(dto.technicalCode);

    let verified: ReturnType<typeof verifyLanLicenseKey>;
    try {
      verified = verifyLanLicenseKey(dto.licenseKey, this.licenseSecret());
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'La licencia LAN no es valida.',
      );
    }

    this.assertLicenseDates(verified.payload);

    const activated = await this.prisma.$transaction(async (transaction) => {
      await transaction.lanLicense.updateMany({
        where: { revokedAt: null },
        data: { revokedAt: new Date() },
      });

      const license = await transaction.lanLicense.upsert({
        where: { licenseId: verified.payload.licenseId },
        update: {
          licenseKey: verified.key,
          clinicName: verified.payload.clinicName.trim(),
          clientLimit: verified.payload.clientLimit,
          issuedAt: new Date(verified.payload.issuedAt),
          expiresAt: verified.payload.expiresAt
            ? new Date(verified.payload.expiresAt)
            : null,
          activatedAt: new Date(),
          revokedAt: null,
          payload: verified.payload as unknown as Prisma.InputJsonObject,
          signature: verified.signature,
        },
        create: {
          licenseKey: verified.key,
          licenseId: verified.payload.licenseId,
          clinicName: verified.payload.clinicName.trim(),
          clientLimit: verified.payload.clientLimit,
          issuedAt: new Date(verified.payload.issuedAt),
          expiresAt: verified.payload.expiresAt
            ? new Date(verified.payload.expiresAt)
            : null,
          payload: verified.payload as unknown as Prisma.InputJsonObject,
          signature: verified.signature,
        },
      });

      await transaction.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'LanLicense',
          entityId: license.id,
          changes: {
            licenseId: license.licenseId,
            clinicName: license.clinicName,
            clientLimit: license.clientLimit,
          },
        },
      });

      await transaction.lanDevice.updateMany({
        where: { revokedAt: null },
        data: { licenseId: license.id },
      });

      return license;
    });

    return {
      active: true,
      license: {
        id: activated.licenseId,
        clinicName: activated.clinicName,
        clientLimit: activated.clientLimit,
        activatedAt: activated.activatedAt.toISOString(),
      },
    };
  }

  async registerDevice(dto: RegisterLanDeviceDto) {
    if (!this.isLanServer()) {
      return {
        authorized: true,
        message: 'La validacion de PCs cliente solo aplica en Servidor LAN.',
      };
    }

    const license = await this.activeLicense();
    if (!license) {
      throw new ForbiddenException(
        'El Servidor LAN no tiene una licencia LAN activa.',
      );
    }

    const existing = await this.prisma.lanDevice.findUnique({
      where: { deviceId: dto.deviceId },
    });

    if (existing) {
      if (existing.revokedAt) {
        throw new ForbiddenException(
          'Esta PC cliente fue desautorizada por soporte tecnico.',
        );
      }

      await this.prisma.lanDevice.update({
        where: { id: existing.id },
        data: {
          deviceName: dto.deviceName.trim(),
          runtimeMode: dto.runtimeMode,
          lastSeenAt: new Date(),
        },
      });

      return {
        authorized: true,
        message: 'PC cliente autorizada.',
        remainingClients: await this.remainingClients(license.id, license.clientLimit),
      };
    }

    const usedClients = await this.prisma.lanDevice.count({
      where: { licenseId: license.id, revokedAt: null },
    });

    if (usedClients >= license.clientLimit) {
      throw new ForbiddenException(
        `La licencia LAN permite ${license.clientLimit} PC(s) cliente. No hay cupos disponibles.`,
      );
    }

    await this.prisma.lanDevice.create({
      data: {
        licenseId: license.id,
        deviceId: dto.deviceId,
        deviceName: dto.deviceName.trim(),
        runtimeMode: dto.runtimeMode,
      },
    });

    return {
      authorized: true,
      message: 'PC cliente registrada correctamente.',
      remainingClients: Math.max(license.clientLimit - usedClients - 1, 0),
    };
  }

  private async activeLicense() {
    const license = await this.prisma.lanLicense.findFirst({
      where: { revokedAt: null },
      orderBy: { activatedAt: 'desc' },
    });

    if (!license) {
      return null;
    }

    if (license.expiresAt && license.expiresAt <= new Date()) {
      await this.prisma.lanLicense.update({
        where: { id: license.id },
        data: { revokedAt: new Date() },
      });
      return null;
    }

    return license;
  }

  private async remainingClients(
    licenseId: string,
    clientLimit: number,
  ): Promise<number> {
    const usedClients = await this.prisma.lanDevice.count({
      where: { licenseId, revokedAt: null },
    });
    return Math.max(clientLimit - usedClients, 0);
  }

  private assertLicenseDates(payload: LanLicensePayload): void {
    const issuedAt = new Date(payload.issuedAt);
    if (Number.isNaN(issuedAt.getTime())) {
      throw new BadRequestException('La licencia LAN tiene una fecha invalida.');
    }

    if (payload.expiresAt) {
      const expiresAt = new Date(payload.expiresAt);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
        throw new BadRequestException('La licencia LAN esta vencida.');
      }
    }
  }

  private assertSupportCode(value: string | undefined): void {
    if ((value ?? '').trim() !== this.supportCode()) {
      throw new ForbiddenException('Codigo tecnico incorrecto.');
    }
  }

  private isLanServer(): boolean {
    return this.config.get<string>('VETCARE_RUNTIME_MODE') === 'lan-server';
  }

  private supportCode(): string {
    return this.config.get<string>('VETCARE_SUPPORT_CODE') ?? DEFAULT_SUPPORT_CODE;
  }

  private licenseSecret(): string {
    return (
      this.config.get<string>('VETCARE_LICENSE_SECRET') ??
      DEFAULT_LICENSE_SECRET
    );
  }
}
