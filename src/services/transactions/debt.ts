import { prisma } from "@/lib/prisma";
import type { ParsedRecord } from "@/types/ai";
import { Prisma } from "@prisma/client";

export interface DebtResult {
  transactionId: string;
  debtId: string;
  personName: string;
  totalOwed: Prisma.Decimal;
}

export async function recordDebt(
  userId: string,
  parsed: ParsedRecord
): Promise<DebtResult | null> {
  if (!parsed.debt_person) return null;

  try {
    const account = await prisma.account.findFirst({
      where: { userId, isDefault: true, isActive: true },
    });
    if (!account) return null;

    const amount = new Prisma.Decimal(parsed.amount);

    const [transaction, debt] = await prisma.$transaction(async (tx) => {
      const t = await tx.transaction.create({
        data: {
          userId,
          accountId: account.id,
          type: parsed.type,
          amount,
          category: parsed.category,
          note: parsed.note || null,
          aiMetadata: parsed as object,
        },
      });

      if (parsed.type === "DEBT_LEND") {
        // เราให้ยืม → หักเงินออก, สร้าง/สะสม WE_LENT
        await tx.account.update({
          where: { id: account.id },
          data: { balance: { decrement: amount } },
        });
        const existing = await tx.debtRecord.findFirst({
          where: { userId, personName: { equals: parsed.debt_person!, mode: "insensitive" }, direction: "WE_LENT", isPaid: false },
        });
        const d = existing
          ? await tx.debtRecord.update({ where: { id: existing.id }, data: { originalAmt: { increment: amount } } })
          : await tx.debtRecord.create({ data: { userId, personName: parsed.debt_person!, direction: "WE_LENT", originalAmt: amount, note: parsed.note || null } });
        return [t, d];

      } else if (parsed.type === "DEBT_BORROW") {
        // เรายืมคนอื่น → เงินเข้า, สร้าง/สะสม WE_OWE
        await tx.account.update({
          where: { id: account.id },
          data: { balance: { increment: amount } },
        });
        const existing = await tx.debtRecord.findFirst({
          where: { userId, personName: { equals: parsed.debt_person!, mode: "insensitive" }, direction: "WE_OWE", isPaid: false },
        });
        const d = existing
          ? await tx.debtRecord.update({ where: { id: existing.id }, data: { originalAmt: { increment: amount } } })
          : await tx.debtRecord.create({ data: { userId, personName: parsed.debt_person!, direction: "WE_OWE", originalAmt: amount, note: parsed.note || null } });
        return [t, d];

      } else {
        // DEBT_REPAY — ดูว่าเราเป็นเจ้าหนี้หรือลูกหนี้กับคนนี้
        const lentDebt = await tx.debtRecord.findFirst({
          where: { userId, personName: { equals: parsed.debt_person!, mode: "insensitive" }, direction: "WE_LENT", isPaid: false },
          orderBy: { createdAt: "asc" },
        });
        const oweDebt = await tx.debtRecord.findFirst({
          where: { userId, personName: { equals: parsed.debt_person!, mode: "insensitive" }, direction: "WE_OWE", isPaid: false },
          orderBy: { createdAt: "asc" },
        });

        // Priority: WE_LENT (รับเงินคืน) > WE_OWE (เราคืนเงิน)
        const targetDebt = lentDebt ?? oweDebt;
        const isReceiving = targetDebt?.direction === "WE_LENT";

        await tx.account.update({
          where: { id: account.id },
          data: { balance: isReceiving ? { increment: amount } : { decrement: amount } },
        });

        if (!targetDebt) {
          // ไม่เจอหนี้ค้าง — สร้าง record ใหม่เป็น WE_LENT paid
          const d = await tx.debtRecord.create({
            data: { userId, personName: parsed.debt_person!, direction: "WE_LENT", originalAmt: amount, paidAmt: amount, isPaid: true, note: parsed.note || null },
          });
          return [t, d];
        }

        const newPaid = targetDebt.paidAmt.plus(amount);
        const isPaid = newPaid.greaterThanOrEqualTo(targetDebt.originalAmt);
        const d = await tx.debtRecord.update({
          where: { id: targetDebt.id },
          data: { paidAmt: newPaid, isPaid },
        });
        return [t, d];
      }
    });

    const remaining = debt.originalAmt.minus(debt.paidAmt);
    return { transactionId: transaction.id, debtId: debt.id, personName: debt.personName, totalOwed: remaining };
  } catch {
    return null;
  }
}
