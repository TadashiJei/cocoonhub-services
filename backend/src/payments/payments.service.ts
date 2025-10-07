import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SetBankConfigDto } from './dto/set-bank-config.dto';
import { CreateManualRequestDto } from './dto/create-manual-request.dto';
import { ApproveManualRequestDto } from './dto/approve-manual-request.dto';
import { RejectManualRequestDto } from './dto/reject-manual-request.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listBanks() {
    const banks = await this.prisma.bank.findMany({
      include: { configs: true },
      orderBy: { code: 'asc' },
    });
    return banks.map((b) => {
      const cfg = b.configs[0];
      return {
        code: b.code,
        name: b.name,
        enabled: cfg?.enabled ?? true,
        dailyLimit: cfg?.dailyLimit ?? 0,
      };
    });
  }

  async setBankConfig(body: SetBankConfigDto) {
    const bank = await this.prisma.bank.findUnique({ where: { code: body.code } });
    if (!bank) throw new NotFoundException('Unknown bank code');

    const updated = await this.prisma.bankConfig.upsert({
      where: { bankCode: body.code },
      create: {
        bankCode: body.code,
        enabled: body.enabled ?? true,
        dailyLimit: body.dailyLimit ?? 0,
      },
      update: {
        enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
        dailyLimit: typeof body.dailyLimit === 'number' ? body.dailyLimit : undefined,
      },
    });

    return {
      ok: true,
      bank: { code: bank.code, name: bank.name, enabled: updated.enabled, dailyLimit: updated.dailyLimit },
    };
  }

  // Fetch a single bank + its current config
  async getBank(code: string) {
    const bank = await this.prisma.bank.findUnique({ where: { code }, include: { configs: true } });
    if (!bank) throw new NotFoundException('Unknown bank code');
    const cfg = bank.configs[0];
    return {
      code: bank.code,
      name: bank.name,
      enabled: cfg?.enabled ?? true,
      dailyLimit: cfg?.dailyLimit ?? 0,
    };
  }

  // Bulk upsert bank configs
  async setBankConfigBulk(items: Array<{ code: string; enabled?: boolean; dailyLimit?: number }>) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('items required');
    }
    const codes = [...new Set(items.map((i) => i.code))];
    const banks = await this.prisma.bank.findMany({ where: { code: { in: codes } } });
    const known = new Map(banks.map((b) => [b.code, b] as const));
    const unknown = codes.filter((c) => !known.has(c));
    if (unknown.length > 0) {
      throw new NotFoundException(`Unknown bank code(s): ${unknown.join(', ')}`);
    }

    const updates = await this.prisma.$transaction(
      items.map((i) =>
        this.prisma.bankConfig.upsert({
          where: { bankCode: i.code },
          create: {
            bankCode: i.code,
            enabled: typeof i.enabled === 'boolean' ? i.enabled : true,
            dailyLimit: typeof i.dailyLimit === 'number' ? i.dailyLimit : 0,
          },
          update: {
            enabled: typeof i.enabled === 'boolean' ? i.enabled : undefined,
            dailyLimit: typeof i.dailyLimit === 'number' ? i.dailyLimit : undefined,
          },
        }),
      ),
    );

    // Return normalized view
    return {
      ok: true,
      banks: updates.map((u) => {
        const b = known.get(u.bankCode)!;
        return { code: b.code, name: b.name, enabled: u.enabled, dailyLimit: u.dailyLimit };
      }),
    };
  }

  // ---------------- Manual Payment Requests ----------------
  async createManualRequest(dto: CreateManualRequestDto) {
    const bank = await this.prisma.bank.findUnique({ where: { code: dto.bankCode } });
    if (!bank) throw new NotFoundException('Unknown bank code');
    const cfg = await this.prisma.bankConfig.findUnique({ where: { bankCode: dto.bankCode } });
    if (cfg && cfg.enabled === false) throw new BadRequestException('Bank disabled');

    // Enforce per-user, per-bank daily limit (if configured)
    if (cfg && cfg.dailyLimit > 0) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      const aggregate = await this.prisma.manualPaymentRequest.aggregate({
        where: {
          userId: dto.userId,
          bankCode: dto.bankCode,
          createdAt: { gte: start, lte: end },
          status: { in: ['submitted', 'under_review', 'approved'] },
        },
        _sum: { amount: true },
      });
      const current = aggregate._sum.amount ?? new Prisma.Decimal(0);
      const newTotal = current.add(dto.amount);
      const limit = new Prisma.Decimal(cfg.dailyLimit);
      if (newTotal.gt(limit)) {
        throw new BadRequestException('Daily limit exceeded for this bank');
      }
    }

    const created = await this.prisma.manualPaymentRequest.create({
      data: {
        userId: dto.userId,
        bankCode: dto.bankCode,
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency,
        status: 'submitted',
        notes: dto.notes ?? null,
      },
    });
    return created;
  }

  async listPendingManualRequests() {
    return this.prisma.manualPaymentRequest.findMany({
      where: { status: { in: ['submitted', 'under_review'] } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveManualRequest(id: string, dto: ApproveManualRequestDto) {
    const req = await this.prisma.manualPaymentRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Not found');
    if (req.status === 'approved') throw new BadRequestException('Already approved');
    if (req.status === 'rejected') throw new BadRequestException('Already rejected');

    const updated = await this.prisma.manualPaymentRequest.update({
      where: { id },
      data: { status: 'approved', notes: dto.notes ?? req.notes },
    });

    await this.prisma.ledgerEntry.create({
      data: {
        userId: req.userId,
        manualRequestId: req.id,
        amount: req.amount,
        currency: req.currency,
        type: 'credit',
        ref: dto.ref ?? `manual:${req.id}`,
      },
    });

    return { ok: true, request: updated };
  }

  async rejectManualRequest(id: string, dto: RejectManualRequestDto) {
    const req = await this.prisma.manualPaymentRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Not found');
    if (req.status === 'approved') throw new BadRequestException('Already approved');
    if (req.status === 'rejected') throw new BadRequestException('Already rejected');

    const updated = await this.prisma.manualPaymentRequest.update({
      where: { id },
      data: { status: 'rejected', notes: dto.notes ?? req.notes },
    });
    return { ok: true, request: updated };
  }

  async reviewManualRequest(id: string, dto: { notes?: string }) {
    const req = await this.prisma.manualPaymentRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Not found');
    if (req.status === 'approved') throw new BadRequestException('Already approved');
    if (req.status === 'rejected') throw new BadRequestException('Already rejected');
    if (req.status === 'under_review') return { ok: true, request: req };

    const updated = await this.prisma.manualPaymentRequest.update({
      where: { id },
      data: { status: 'under_review', notes: dto.notes ?? req.notes },
    });
    return { ok: true, request: updated };
  }
}
