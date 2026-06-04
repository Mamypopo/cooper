import { prisma } from "@/lib/prisma";
import type { ParsedRecord } from "@/types/ai";
import { Prisma } from "@prisma/client";

export interface RecordResult {
  transactionId: string;
  newBalance: Prisma.Decimal;
  accountName: string;
}

export async function recordTransaction(
  userId: string,
  parsed: ParsedRecord
): Promise<RecordResult | null> {
  try {
    const account = await resolveAccount(userId, parsed.account_name);
    if (!account) return null;

    const isDebit =
      parsed.type === "EXPENSE" ||
      parsed.type === "DEBT_LEND" ||
      parsed.type === "TRANSFER";

    const amount = new Prisma.Decimal(parsed.amount);

    const [transaction, updatedAccount] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          userId,
          accountId: account.id,
          type: parsed.type,
          amount,
          category: parsed.category,
          note: parsed.note || null,
          aiMetadata: parsed as object,
        },
      }),
      prisma.account.update({
        where: { id: account.id },
        data: {
          balance: isDebit
            ? { decrement: amount }
            : { increment: amount },
        },
      }),
    ]);

    return {
      transactionId: transaction.id,
      newBalance: updatedAccount.balance,
      accountName: updatedAccount.name,
    };
  } catch {
    return null;
  }
}

async function resolveAccount(userId: string, accountName: string) {
  const byName = await prisma.account.findFirst({
    where: { userId, name: { contains: accountName, mode: "insensitive" }, isActive: true },
  });
  if (byName) return byName;

  return prisma.account.findFirst({
    where: { userId, isDefault: true, isActive: true },
  });
}
