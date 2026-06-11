import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

@Injectable()
export class LocalSecurityService {
  private readonly jwtSecret: string;

  constructor(config: ConfigService) {
    const configuredDirectory = config.get<string>('VETCARE_DATA_DIR');
    const dataDirectory = configuredDirectory
      ? isAbsolute(configuredDirectory)
        ? configuredDirectory
        : resolve(process.cwd(), configuredDirectory)
      : resolve(process.cwd(), '..', '..', '.data');
    const securityDirectory = resolve(dataDirectory, 'security');
    const secretPath = resolve(securityDirectory, 'jwt-secret.key');

    mkdirSync(securityDirectory, { recursive: true });

    try {
      this.jwtSecret = readFileSync(secretPath, 'utf8').trim();
    } catch {
      this.jwtSecret = randomBytes(64).toString('base64url');
      writeFileSync(secretPath, this.jwtSecret, {
        encoding: 'utf8',
        mode: 0o600,
        flag: 'wx',
      });
    }
  }

  getJwtSecret(): string {
    return this.jwtSecret;
  }
}

