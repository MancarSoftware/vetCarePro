import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

