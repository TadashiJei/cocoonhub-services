import { Injectable } from '@nestjs/common';

interface PresignParams {
  key: string;
  contentType: string;
}

@Injectable()
export class StorageService {
  // Placeholder presign for Cloudflare R2 (S3-compatible) without SDK
  // Returns a simple PUT URL that a proxy or future implementation can honor
  presignUpload({ key, contentType }: PresignParams) {
    const bucket = process.env.R2_BUCKET || process.env.S3_BUCKET || 'bucket';
    const base = process.env.R2_PUBLIC_BASE_URL || process.env.S3_ENDPOINT || 'https://r2.example';
    const url = `${base.replace(/\/$/, '')}/${bucket}/${encodeURIComponent(key)}`;

    return {
      url,
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      expiresIn: 300, // seconds
      key,
      bucket,
    };
  }
}
