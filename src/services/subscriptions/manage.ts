import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface SubscriptionResult {
  name: string;
  amount: Prisma.Decimal;
  billingDay: number;
  isNew: boolean;
}

export async function upsertSubscription(
  userId: string,
  name: string,
  amount: number,
  billingDay: number
): Promise<SubscriptionResult | null> {
  try {
    const existing = await prisma.subscription.findFirst({
      where: { userId, name: { equals: name, mode: "insensitive" }, isActive: true },
    });

    if (existing) {
      const updated = await prisma.subscription.update({
        where: { id: existing.id },
        data: { amount: new Prisma.Decimal(amount), billingDay },
      });
      return { name: updated.name, amount: updated.amount, billingDay: updated.billingDay, isNew: false };
    }

    const created = await prisma.subscription.create({
      data: { userId, name, amount: new Prisma.Decimal(amount), billingDay },
    });

    return { name: created.name, amount: created.amount, billingDay: created.billingDay, isNew: true };
  } catch {
    return null;
  }
}

export async function getSubscriptions(userId: string) {
  return prisma.subscription.findMany({
    where: { userId, isActive: true },
    orderBy: { billingDay: "asc" },
  });
}

export interface CancelSubResult {
  name: string;
}

export interface CancelSubError {
  type: "SUB_NOT_FOUND";
  requestedName: string;
}

export async function cancelSubscription(
  userId: string,
  name: string
): Promise<CancelSubResult | CancelSubError | null> {
  try {
    const sub = await prisma.subscription.findFirst({
      where: { userId, name: { contains: name, mode: "insensitive" }, isActive: true },
    });
    if (!sub) return { type: "SUB_NOT_FOUND", requestedName: name };
    await prisma.subscription.update({ where: { id: sub.id }, data: { isActive: false } });
    return { name: sub.name };
  } catch {
    return null;
  }
}

// parser: "ยกเลิกบิล Netflix" / "ลบบิล ค่าเน็ต" / "ยกเลิก subscription Netflix"
export function parseCancelSubCommand(text: string): string | null {
  const m = text.match(/(?:ยกเลิกบิล|ลบบิล|ยกเลิก subscription|cancel bill|cancel subscription)\s+(.+)/i);
  return m ? m[1].trim() : null;
}

// parser: "เพิ่มบิล Netflix 299 วันที่ 15" / "บิล ค่าเน็ต 590 วัน 20"
export function parseSubscriptionCommand(text: string): {
  name: string;
  amount: number;
  billingDay: number;
} | null {
  const match = text.match(
    /(?:เพิ่มบิล|บิล|subscription)\s+(.+?)\s+([\d,]+)\s+(?:วันที่|วัน)\s*(\d{1,2})/i
  );
  if (!match) return null;

  const name = match[1].trim();
  const amount = parseInt(match[2].replace(/,/g, ""), 10);
  const billingDay = parseInt(match[3], 10);

  if (!name || isNaN(amount) || isNaN(billingDay) || billingDay < 1 || billingDay > 31) return null;
  return { name, amount, billingDay };
}
