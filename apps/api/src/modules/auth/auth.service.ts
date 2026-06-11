import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from '../../security/password.service';
import { ROLE_CODES } from './authorization.constants';
import { InitializeSystemDto } from './dto/initialize-system.dto';
import { LoginDto } from './dto/login.dto';

interface AuthUserRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: Array<{
    role: {
      code: string;
      permissions: Array<{ permission: { code: string } }>;
    };
  }>;
}

export interface AuthResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  user: Omit<AuthenticatedUser, 'sessionId'>;
}

@Injectable()
export class AuthService {
  private readonly accessTokenTtlMinutes: number;
  private readonly refreshTokenTtlDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    config: ConfigService,
  ) {
    this.accessTokenTtlMinutes = Number(
      config.get('ACCESS_TOKEN_TTL_MINUTES', 15),
    );
    this.refreshTokenTtlDays = Number(
      config.get('REFRESH_TOKEN_TTL_DAYS', 30),
    );
  }

  async getSetupStatus(): Promise<{ setupRequired: boolean }> {
    const users = await this.prisma.user.count({
      where: { deletedAt: null },
    });
    return { setupRequired: users === 0 };
  }

  async initialize(dto: InitializeSystemDto): Promise<AuthResponse> {
    const passwordHash = await this.passwordService.hash(dto.password);
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.$transaction(
      async (transaction) => {
        const users = await transaction.user.count({
          where: { deletedAt: null },
        });
        if (users > 0) {
          throw new ConflictException('El sistema ya fue configurado');
        }

        const adminRole = await transaction.role.findUnique({
          where: { code: ROLE_CODES.ADMIN },
        });
        if (!adminRole) {
          throw new ConflictException(
            'Los roles iniciales todavía no están disponibles',
          );
        }

        return transaction.user.create({
          data: {
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            email,
            passwordHash,
            roles: {
              create: { roleId: adminRole.id },
            },
          },
          include: this.authUserInclude(),
        });
      },
      {
        isolationLevel: 'Serializable',
      },
    );

    return this.createSession(user, dto.deviceName);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      include: this.authUserInclude(),
    });

    if (
      !user ||
      user.deletedAt ||
      user.status !== 'ACTIVE' ||
      !(await this.passwordService.verify(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.createSession(user, dto.deviceName);
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: {
        user: {
          include: this.authUserInclude(),
        },
      },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.deletedAt ||
      session.user.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException('La sesión expiró');
    }

    const nextRefreshToken = this.generateRefreshToken();
    const expiresAt = this.addDays(new Date(), this.refreshTokenTtlDays);
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.hashRefreshToken(nextRefreshToken),
        expiresAt,
        lastUsedAt: new Date(),
      },
    });

    return this.buildAuthResponse(
      session.user,
      session.id,
      nextRefreshToken,
    );
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    await this.prisma.session.updateMany({
      where: {
        refreshTokenHash: this.hashRefreshToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  private async createSession(
    user: AuthUserRecord,
    deviceName: string,
  ): Promise<AuthResponse> {
    const refreshToken = this.generateRefreshToken();
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: this.hashRefreshToken(refreshToken),
        deviceName: deviceName.trim(),
        expiresAt: this.addDays(new Date(), this.refreshTokenTtlDays),
      },
    });

    return this.buildAuthResponse(user, session.id, refreshToken);
  }

  private async buildAuthResponse(
    user: AuthUserRecord,
    sessionId: string,
    refreshToken: string,
  ): Promise<AuthResponse> {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      sid: sessionId,
      type: 'access',
    });
    const accessTokenExpiresAt = new Date(
      Date.now() + this.accessTokenTtlMinutes * 60_000,
    );

    return {
      accessToken,
      accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
      refreshToken,
      user: this.toPublicUser(user),
    };
  }

  private toPublicUser(
    user: AuthUserRecord,
  ): Omit<AuthenticatedUser, 'sessionId'> {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roles: user.roles.map(({ role }) => role.code),
      permissions: [
        ...new Set(
          user.roles.flatMap(({ role }) =>
            role.permissions.map(({ permission }) => permission.code),
          ),
        ),
      ],
    };
  }

  private authUserInclude() {
    return {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
    } as const;
  }

  private generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
