import { Global, Module } from '@nestjs/common';
import { LocalSecurityService } from './local-security.service';
import { PasswordService } from './password.service';

@Global()
@Module({
  providers: [LocalSecurityService, PasswordService],
  exports: [LocalSecurityService, PasswordService],
})
export class SecurityModule {}

