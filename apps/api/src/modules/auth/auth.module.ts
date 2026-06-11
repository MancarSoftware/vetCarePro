import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { LocalSecurityService } from '../../security/local-security.service';
import { SecurityModule } from '../../security/security.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthorizationBootstrapService } from './authorization-bootstrap.service';

@Module({
  imports: [
    ConfigModule,
    SecurityModule,
    JwtModule.registerAsync({
      imports: [SecurityModule],
      inject: [LocalSecurityService, ConfigService],
      useFactory: (
        security: LocalSecurityService,
        config: ConfigService,
      ) => ({
        secret: security.getJwtSecret(),
        signOptions: {
          expiresIn:
            Number(config.get('ACCESS_TOKEN_TTL_MINUTES', 15)) * 60,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthorizationBootstrapService,
    JwtAuthGuard,
    PermissionsGuard,
  ],
  exports: [JwtModule, JwtAuthGuard, PermissionsGuard],
})
export class AuthModule {}
