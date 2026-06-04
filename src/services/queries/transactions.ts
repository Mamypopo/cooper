import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface RecentTransaction {
  note: string | null;
  category: string;
  type: string;
  amount: Prisma.Decimal;
  accountName: string;
  recordedAt: Date;
}

export async function getRecentTransactions(
  userId: string,
  limit = 7
): Promise<RecentTransaction[]> {
  const txs = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { recordedAt: "desc" },
    take: limit,
    include: { account: { select: { name: true } } },
  });

  return txs.map((t) => ({
    note: t.note,
    category: t.category,
    type: t.type,
    amount: t.amount,
    accountName: t.account.name,
    recordedAt: t.recordedAt,
  }));
}
