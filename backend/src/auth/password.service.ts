import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  // Argon2id default options; tune memoryCost/timeCost/parallelism for your infra
  private readonly options: argon2.Options & { type: argon2.ArgonType } = {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // 64 MiB
    timeCost: 3,
    parallelism: 1,
  };

  hash(password: string) {
    return argon2.hash(password, this.options);
  }

  verify(hash: string, plain: string) {
    return argon2.verify(hash, plain, this.options);
  }
}
