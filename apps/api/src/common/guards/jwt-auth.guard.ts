import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import type {
  AccessTokenPayload,
  AuthenticatedUser,
} from '../auth/authenticated-user';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('La sesión es requerida');
    }

    let payload: AccessTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('La sesión no es válida o expiró');
    }

    if (payload.type !== 'access' || !payload.sub || !payload.sid) {
      throw new UnauthorizedException('La sesión no es válida');
    }

    const session = await this.prisma.session.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: {
          status: 'ACTIVE',
          deletedAt: null,
        },
      },
      include: {
        user: {
          include: {
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
          },
        },
      },
    });

    if (!session) {
      throw new UnauthorizedException('La sesión fue cerrada o expiró');
    }

    request.user = this.toAuthenticatedUser(session.user, session.id);
    return true;
  }

  private extractBearerToken(
    authorization: string | undefined,
  ): string | null {
    if (!authorization) {
      return null;
    }

    const [type, token] = authorization.split(' ');
    return type === 'Bearer' && token ? token : null;
  }

  private toAuthenticatedUser(
    user: {
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
    },
    sessionId: string,
  ): AuthenticatedUser {
    const roles = user.roles.map(({ role }) => role.code);
    const permissions = [
      ...new Set(
        user.roles.flatMap(({ role }) =>
          role.permissions.map(({ permission }) => permission.code),
        ),
      ),
    ];

    return {
      id: user.id,
      sessionId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roles,
      permissions,
    };
  }
}

