import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SetKycStatusDto } from './dto/set-kyc-status.dto';
import { CryptoService } from '../security/crypto.service';

@Injectable()
export class KycService {
  constructor(private readonly prisma: PrismaService, private readonly crypto: CryptoService) {}

  private encryptNotes(notes?: string | null): string | null {
    if (!notes) return null;
    const enc = this.crypto.encrypt(notes);
    return JSON.stringify(enc);
  }

  private decryptNotes(notes?: string | null): string | null {
    if (!notes) return null;
    try {
      const payload = JSON.parse(notes);
      if (payload && payload.iv && payload.authTag && payload.ciphertext) {
        return this.crypto.decrypt(payload);
      }
      return notes;
    } catch {
      return notes;
    }
  }

  async apply(userId: string, documents?: Array<{ type: string; fileRef: string }>) {
    const app = await this.prisma.kycApplication.create({
      data: {
        userId,
        status: 'pending',
        documents: documents && documents.length > 0 ? {
          create: documents.map((d) => ({ type: d.type, fileRef: d.fileRef }))
        } : undefined,
      },
      include: { documents: true },
    });
    return app;
  }

  async list() {
    const apps = await this.prisma.kycApplication.findMany({
      include: { documents: true },
      orderBy: { createdAt: 'desc' },
    });
    return apps.map((a) => ({ ...a, notes: this.decryptNotes(a.notes as any) }));
  }

  async listDecisions(applicationId: string) {
    const items = await this.prisma.kycDecisionLog.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
    });
    return items.map((d) => ({ ...d, notes: this.decryptNotes(d.notes as any) }));
  }

  async setStatus(id: string, body: SetKycStatusDto, reviewerUserId?: string) {
    const exists = await this.prisma.kycApplication.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Not found');
    const updated = await this.prisma.kycApplication.update({
      where: { id },
      data: { status: body.status, notes: this.encryptNotes(body.notes) },
    });

    await this.prisma.kycDecisionLog.create({
      data: {
        applicationId: id,
        reviewerUserId: reviewerUserId ?? null,
        decision: body.status,
        notes: this.encryptNotes(body.notes),
      },
    });
    const decrypted = { ...updated, notes: this.decryptNotes(updated.notes as any) } as any;
    return { ok: true, application: decrypted };
  }
}
