import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface CloseDebtResult {
  personName: string;
  amount: number;
  direction: "WE_LENT" | "WE_OWE";
  accountName: string;
  newBalance: Prisma.Decimal;
}

export interface CloseDebtError {
  type: "DEBT_NOT_FOUND";
  personName: string;
}

export async function closeDebt(
  userId: string,
  personName: string
): Promise<CloseDebtResult | CloseDebtError | null> {
  try {
    // หาหนี้ทั้ง 2 ทิศทาง — priority WE_LENT (รับคืน) ก่อน
    const debt =
      (await prisma.debtRecord.findFirst({
        where: { userId, personName: { contains: personName, mode: "insensitive" }, direction: "WE_LENT", isPaid: false },
      })) ??
      (await prisma.debtRecord.findFirst({
        where: { userId, personName: { contains: personName, mode: "insensitive" }, direction: "WE_OWE", isPaid: false },
      }));

    if (!debt) return { type: "DEBT_NOT_FOUND", personName };

    const remaining = debt.originalAmt.minus(debt.paidAmt);
    const isReceiving = debt.direction === "WE_LENT";

    const account = await prisma.account.findFirst({
      where: { userId, isDefault: true, isActive: true },
    });
    if (!account) return null;

    const [, updatedAccount] = await prisma.$transaction([
      prisma.debtRecord.update({
        where: { id: debt.id },
        data: { paidAmt: debt.originalAmt, isPaid: true },
      }),
      prisma.account.update({
        where: { id: account.id },
        data: { balance: isReceiving ? { increment: remaining } : { decrement: remaining } },
      }),
      prisma.transaction.create({
        data: {
          userId,
          accountId: account.id,
          type: "DEBT_REPAY",
          amount: remaining,
          category: isReceiving ? "รับคืนหนี้" : "คืนหนี้",
          note: isReceiving ? `${debt.personName} คืนครบ` : `คืนเงิน ${debt.personName} ครบ`,
        },
      }),
    ]);

    return {
      personName: debt.personName,
      amount: Number(remaining),
      direction: debt.direction,
      accountName: updatedAccount.name,
      newBalance: updatedAccount.balance,
    };
  } catch {
    return null;
  }
}
