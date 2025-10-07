import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface CreateProgramInput {
  name: string;
  description?: string;
  amount: number;
  currency: string;
}

interface CreateCycleInput {
  programId: string;
  periodStart: Date;
  periodEnd: Date;
}

@Injectable()
export class UbiService {
  constructor(private readonly prisma: PrismaService) {}

  // Programs
  async createProgram(input: CreateProgramInput) {
    if (input.amount <= 0) throw new BadRequestException('amount must be > 0');
    return this.prisma.ubiProgram.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        rules: { amount: input.amount, currency: input.currency, eligibility: 'all_enrolled' },
      },
    });
  }

  listPrograms() {
    return this.prisma.ubiProgram.findMany({ orderBy: { createdAt: 'desc' } });
  }

  // Enrollment
  async enrollUser(programId: string, userId: string) {
    // Ensure program exists
    const program = await this.prisma.ubiProgram.findUnique({ where: { id: programId } });
    if (!program) throw new NotFoundException('Program not found');
    return this.prisma.ubiEnrollment.upsert({
      where: { userId_programId: { userId, programId } },
      update: { status: 'active' },
      create: { programId, userId, status: 'active' },
    });
  }

  // Cycles
  async createCycle(input: CreateCycleInput) {
    if (input.periodEnd <= input.periodStart) throw new BadRequestException('periodEnd must be after periodStart');
    // Ensure program exists
    const program = await this.prisma.ubiProgram.findUnique({ where: { id: input.programId } });
    if (!program) throw new NotFoundException('Program not found');
    return this.prisma.ubiCycle.create({
      data: {
        programId: input.programId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        status: 'draft',
      },
    });
  }

  async computeCycle(cycleId: string) {
    const cycle = await this.prisma.ubiCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new NotFoundException('Cycle not found');
    const program = await this.prisma.ubiProgram.findUnique({ where: { id: cycle.programId } });
    if (!program) throw new NotFoundException('Program not found');
    const rules = program.rules as any;
    const amount = new Prisma.Decimal(rules?.amount ?? 0);
    const currency = String(rules?.currency ?? 'PHP');
    if (amount.lte(0)) throw new BadRequestException('Program rules missing valid amount');

    const enrollments = await this.prisma.ubiEnrollment.findMany({
      where: { programId: cycle.programId, status: 'active' },
      select: { userId: true },
    });

    return this.prisma.$transaction(async (tx: PrismaClient) => {
      // create payouts if not exists for this user in this cycle
      for (const e of enrollments) {
        const existing = await tx.ubiPayout.findFirst({ where: { cycleId: cycle.id, userId: e.userId } });
        if (!existing) {
          await tx.ubiPayout.create({
            data: {
              cycleId: cycle.id,
              userId: e.userId,
              amount,
              currency,
              status: 'pending',
            },
          });
        }
      }
      await tx.ubiCycle.update({ where: { id: cycle.id }, data: { status: 'computed' } });
      return { ok: true };
    });
  }

  async submitCycleForApproval(cycleId: string) {
    const cycle = await this.prisma.ubiCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new NotFoundException('Cycle not found');
    if (cycle.status !== 'computed') throw new BadRequestException('Cycle must be computed first');
    await this.prisma.ubiCycle.update({ where: { id: cycleId }, data: { status: 'pending_approval' } });
    return { ok: true };
  }

  async approveCycle(cycleId: string) {
    const cycle = await this.prisma.ubiCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new NotFoundException('Cycle not found');
    if (cycle.status !== 'pending_approval') throw new BadRequestException('Cycle is not pending approval');

    const payouts = await this.prisma.ubiPayout.findMany({ where: { cycleId, status: 'pending' } });
    return this.prisma.$transaction(async (tx: PrismaClient) => {
      for (const p of payouts) {
        await tx.ubiPayout.update({ where: { id: p.id }, data: { status: 'approved' } });
        await tx.ledgerEntry.create({
          data: {
            userId: p.userId,
            ubiPayoutId: p.id,
            amount: p.amount,
            currency: p.currency,
            type: 'credit',
            ref: `ubi:${cycleId}:${p.id}`,
          },
        });
      }
      await tx.ubiCycle.update({ where: { id: cycleId }, data: { status: 'approved' } });
      return { ok: true };
    });
  }

  // Member ledger: returns ledger entries from UBI
  listMemberUbiLedger(userId: string) {
    return this.prisma.ledgerEntry.findMany({
      where: { userId, ubiPayoutId: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
