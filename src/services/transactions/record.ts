import { prisma } from "@/lib/prisma";
import type { ParsedRecord } from "@/types/ai";
import { Prisma } from "@prisma/client";

export interface RecordResult {
  transactionId: string;
  newBalance: Prisma.Decimal;
  accountName: string;
}

export interface AccountNotFoundError {
  type: "ACCOUNT_NOT_FOUND";
  requestedName: string;
}

export async function recordTransaction(
  userId: string,
  parsed: ParsedRecord
): Promise<RecordResult | AccountNotFoundError | null> {
  try {
    const { account, foundByName } = await resolveAccount(userId, parsed.account_name);
    if (!account) return null;

    // ถ้าหาบัญชีตามชื่อไม่เจอ → แจ้งผู้ใช้แทนการ fallback เงียบๆ
    if (!foundByName && parsed.account_name !== "กระเป๋าหลัก") {
      return { type: "ACCOUNT_NOT_FOUND", requestedName: parsed.account_name };
    }

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
  if (byName) return { account: byName, foundByName: true };

  const defaultAccount = await prisma.account.findFirst({
    where: { userId, isDefault: true, isActive: true },
  });
  return { account: defaultAccount, foundByName: false };
}
