import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface CancelResult {
  note: string;
  category: string;
  amount: number;
  type: string;
  accountName: string;
  newBalance: Prisma.Decimal;
}

export interface CancelError {
  type: "NO_TRANSACTION" | "UNSUPPORTED_TYPE";
}

export async function cancelLatestTransaction(
  userId: string
): Promise<CancelResult | CancelError | null> {
  try {
    const latest = await prisma.transaction.findFirst({
      where: { userId },
      orderBy: { recordedAt: "desc" },
      include: { account: true },
    });

    if (!latest) return { type: "NO_TRANSACTION" };

    // TRANSFER และ DEBT ซับซ้อนเกินไปสำหรับ auto-reverse — ให้ user จัดการเอง
    if (latest.type === "TRANSFER" || latest.type === "DEBT_LEND" || latest.type === "DEBT_REPAY") {
      return { type: "UNSUPPORTED_TYPE" };
    }

    const isDebit = latest.type === "EXPENSE";
    const [, updatedAccount] = await prisma.$transaction([
      prisma.transaction.delete({ where: { id: latest.id } }),
      prisma.account.update({
        where: { id: latest.accountId },
        data: {
          balance: isDebit
            ? { increment: latest.amount }
            : { decrement: latest.amount },
        },
      }),
    ]);

    return {
      note: latest.note ?? latest.category,
      category: latest.category,
      amount: Number(latest.amount),
      type: latest.type,
      accountName: latest.account.name,
      newBalance: updatedAccount.balance,
    };
  } catch {
    return null;
  }
}
