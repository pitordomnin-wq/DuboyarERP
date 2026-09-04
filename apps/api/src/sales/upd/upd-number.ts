import type { PrismaClient } from '@prisma/client';

/** Next УПД number for organization in calendar year: УПД-YYYY-NNNN */
export async function nextUpdNumber(prisma: PrismaClient, organizationId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `УПД-${year}-`;
  const count = await prisma.dealDocument.count({
    where: {
      kind: { in: ['UPD_XLSX', 'UPD_PDF'] },
      title: { startsWith: prefix },
      deal: { organizationId },
    },
  });
  // Each generation creates 2 docs; sequence by pairs.
  const seq = Math.floor(count / 2) + 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}
