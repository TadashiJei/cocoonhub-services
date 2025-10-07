import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

// AES-256-GCM application-level encryption helper
@Injectable()
export class CryptoService {
  private key: Buffer;

  constructor() {
    const b64 = process.env.APP_DATA_KEY;
    if (!b64) {
      // Safe to run without key only in dev; throw in production
      if (process.env.NODE_ENV === 'production') {
        throw new InternalServerErrorException('APP_DATA_KEY missing');
      }
      // fallback dev key
      this.key = Buffer.alloc(32, 0);
    } else {
      this.key = Buffer.from(b64, 'base64');
      if (this.key.length !== 32) throw new InternalServerErrorException('APP_DATA_KEY must be 32 bytes base64');
    }
  }

  encrypt(plaintext: string): { iv: string; authTag: string; ciphertext: string } {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
  }

  decrypt(payload: { iv: string; authTag: string; ciphertext: string }): string {
    const iv = Buffer.from(payload.iv, 'base64');
    const authTag = Buffer.from(payload.authTag, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, 'base64')), decipher.final()]);
    return plaintext.toString('utf8');
  }
}
