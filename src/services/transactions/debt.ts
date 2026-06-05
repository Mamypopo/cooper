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
    const isLend = parsed.type === "DEBT_LEND";

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

      // LEND: หักเงินออก | REPAY: บวกเงินกลับเข้า
      await tx.account.update({
        where: { id: account.id },
        data: { balance: isLend ? { decrement: amount } : { increment: amount } },
      });

      if (isLend) {
        // เพิ่มหรือสะสมหนี้ที่ให้ยืม
        const existing = await tx.debtRecord.findFirst({
          where: { userId, personName: { equals: parsed.debt_person!, mode: "insensitive" }, direction: "WE_LENT", isPaid: false },
        });
        const d = existing
          ? await tx.debtRecord.update({
              where: { id: existing.id },
              data: { originalAmt: { increment: amount } },
            })
          : await tx.debtRecord.create({
              data: { userId, personName: parsed.debt_person!, direction: "WE_LENT", originalAmt: amount, note: parsed.note || null },
            });
        return [t, d];
      } else {
        // REPAY: อัปเดต paidAmt และปิดหนี้ถ้าชำระครบ
        const existing = await tx.debtRecord.findFirst({
          where: { userId, personName: { equals: parsed.debt_person!, mode: "insensitive" }, direction: "WE_LENT", isPaid: false },
          orderBy: { createdAt: "asc" },
        });
        if (!existing) {
          // ไม่เจอหนี้ที่ค้างอยู่ — สร้าง record ใหม่เป็น WE_OWE แทน
          const d = await tx.debtRecord.create({
            data: { userId, personName: parsed.debt_person!, direction: "WE_OWE", originalAmt: amount, paidAmt: amount, isPaid: true, note: parsed.note || null },
          });
          return [t, d];
        }
        const newPaid = existing.paidAmt.plus(amount);
        const isPaid = newPaid.greaterThanOrEqualTo(existing.originalAmt);
        const d = await tx.debtRecord.update({
          where: { id: existing.id },
          data: { paidAmt: newPaid, isPaid },
        });
        return [t, d];
      }
    });

    const remaining = debt.originalAmt.minus(debt.paidAmt);

    return {
      transactionId: transaction.id,
      debtId: debt.id,
      personName: debt.personName,
      totalOwed: remaining,
    };
  } catch {
    return null;
  }
}
