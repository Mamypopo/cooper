import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface DebtSummary {
  lending: { personName: string; amount: Prisma.Decimal; daysAgo: number }[];
  owing: { personName: string; amount: Prisma.Decimal; dueDate: Date | null }[];
  totalLending: Prisma.Decimal;
  totalOwing: Prisma.Decimal;
}

export async function getDebtSummary(userId: string): Promise<DebtSummary> {
  const debts = await prisma.debtRecord.findMany({
    where: { userId, isPaid: false },
    orderBy: { createdAt: "desc" },
  });

  const lending = debts
    .filter((d) => d.direction === "WE_LENT")
    .map((d) => ({
      personName: d.personName,
      amount: d.originalAmt.minus(d.paidAmt),
      daysAgo: Math.floor((Date.now() - d.createdAt.getTime()) / 86400000),
    }));

  const owing = debts
    .filter((d) => d.direction === "WE_OWE")
    .map((d) => ({
      personName: d.personName,
      amount: d.originalAmt.minus(d.paidAmt),
      dueDate: d.dueDate,
    }));

  const totalLending = lending.reduce((s, d) => s.plus(d.amount), new Prisma.Decimal(0));
  const totalOwing = owing.reduce((s, d) => s.plus(d.amount), new Prisma.Decimal(0));

  return { lending, owing, totalLending, totalOwing };
}
