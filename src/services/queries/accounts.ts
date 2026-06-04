import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface AccountSummary {
  accounts: { name: string; balance: Prisma.Decimal; type: string }[];
  totalBalance: Prisma.Decimal;
}

export async function getAccountSummary(userId: string): Promise<AccountSummary> {
  const accounts = await prisma.account.findMany({
    where: { userId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  const totalBalance = accounts.reduce(
    (sum, a) => sum.plus(a.balance),
    new Prisma.Decimal(0)
  );

  return {
    accounts: accounts.map((a) => ({ name: a.name, balance: a.balance, type: a.type })),
    totalBalance,
  };
}
