import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Membership tiers
  const tiers = [
    { name: 'Black', priority: 1, entitlements: { limits: {}, features: [] } },
    { name: 'Titanium', priority: 2, entitlements: { limits: {}, features: [] } },
    { name: 'Platinum', priority: 3, entitlements: { limits: {}, features: [] } },
    { name: 'Gold', priority: 4, entitlements: { limits: {}, features: [] } },
  ];
  for (const t of tiers) {
    await prisma.membershipTier.upsert({
      where: { name: t.name },
      create: { name: t.name, priority: t.priority, entitlements: t.entitlements },
      update: { priority: t.priority, entitlements: t.entitlements },
    });
  }

  // Banks
  const banks = [
    { code: 'BDO', name: 'Banco de Oro' },
    { code: 'GCASH', name: 'GCash' },
    { code: 'MAYA', name: 'Maya' },
    { code: 'BPI', name: 'Bank of the Philippine Islands' },
    { code: 'UNIONBANK', name: 'UnionBank' },
  ];
  for (const b of banks) {
    await prisma.bank.upsert({
      where: { code: b.code },
      create: { code: b.code, name: b.name },
      update: { name: b.name },
    });

    await prisma.bankConfig.upsert({
      where: { bankCode: b.code },
      create: { bankCode: b.code, enabled: true, dailyLimit: 0 },
      update: {},
    });
  }

  // Optionally seed a default admin user later
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
