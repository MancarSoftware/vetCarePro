import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

const PUBLIC_PATH_PREFIXES = [
  '/api/health',
  '/api/lan-license',
  '/api/auth/setup-status',
];

@Injectable()
export class LanDeviceGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.config.get<string>('VETCARE_RUNTIME_MODE') !== 'lan-server') {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    if (this.isPublicPath(request.path)) {
      return true;
    }

    const runtimeMode = this.headerValue(request, 'x-vetcare-runtime-mode');
    if (runtimeMode !== 'lan-client') {
      return true;
    }

    const deviceId = this.headerValue(request, 'x-vetcare-device-id');
    if (!deviceId) {
      throw new ForbiddenException(
        'Esta PC cliente no tiene identificador LAN.',
      );
    }

    const license = await this.prisma.lanLicense.findFirst({
      where: { revokedAt: null },
      orderBy: { activatedAt: 'desc' },
    });
    if (!license) {
      throw new ForbiddenException(
        'El Servidor LAN no tiene una licencia LAN activa.',
      );
    }

    if (license.expiresAt && license.expiresAt <= new Date()) {
      throw new ForbiddenException('La licencia LAN esta vencida.');
    }

    const device = await this.prisma.lanDevice.findUnique({
      where: { deviceId },
    });
    if (!device || device.revokedAt || device.licenseId !== license.id) {
      throw new ForbiddenException(
        'Esta PC cliente no esta autorizada en la licencia LAN.',
      );
    }

    await this.prisma.lanDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });

    return true;
  }

  private isPublicPath(path: string): boolean {
    return PUBLIC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
  }

  private headerValue(request: Request, key: string): string {
    const value = request.headers[key];
    return Array.isArray(value) ? value[0] ?? '' : value ?? '';
  }
}
