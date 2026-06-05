import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface TransferResult {
  amount: number;
  fromAccount: { name: string; newBalance: Prisma.Decimal };
  toAccount: { name: string; newBalance: Prisma.Decimal };
}

export interface TransferAccountNotFoundError {
  type: "ACCOUNT_NOT_FOUND";
  requestedName: string;
}

export async function transferBetweenAccounts(
  userId: string,
  amount: number,
  fromAccountName: string,
  toAccountName: string
): Promise<TransferResult | TransferAccountNotFoundError | null> {
  try {
    const fromAccount = await prisma.account.findFirst({
      where: { userId, name: { contains: fromAccountName, mode: "insensitive" }, isActive: true },
    });
    if (!fromAccount) return { type: "ACCOUNT_NOT_FOUND", requestedName: fromAccountName };

    const toAccount = await prisma.account.findFirst({
      where: { userId, name: { contains: toAccountName, mode: "insensitive" }, isActive: true },
    });
    if (!toAccount) return { type: "ACCOUNT_NOT_FOUND", requestedName: toAccountName };

    const decimalAmount = new Prisma.Decimal(amount);

    const [, updatedFrom, updatedTo] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          userId,
          accountId: fromAccount.id,
          type: "TRANSFER",
          amount: decimalAmount,
          category: "โอนเงิน",
          note: `โอนไป ${toAccount.name}`,
        },
      }),
      prisma.account.update({
        where: { id: fromAccount.id },
        data: { balance: { decrement: decimalAmount } },
      }),
      prisma.account.update({
        where: { id: toAccount.id },
        data: { balance: { increment: decimalAmount } },
      }),
    ]);

    return {
      amount,
      fromAccount: { name: updatedFrom.name, newBalance: updatedFrom.balance },
      toAccount: { name: updatedTo.name, newBalance: updatedTo.balance },
    };
  } catch {
    return null;
  }
}
