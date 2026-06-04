import { prisma } from "@/lib/prisma";
import { anthropic, SYSTEM_PROMPT } from "@/lib/claude";
import { Prisma } from "@prisma/client";

async function buildBudgetContext(userId: string): Promise<string> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [accounts, recentExpenses, pendingDebts, upcomingBills] = await Promise.all([
    prisma.account.findMany({
      where: { userId, isActive: true },
      select: { name: true, balance: true, isDefault: true },
    }),
    prisma.transaction.aggregate({
      where: {
        userId,
        type: { in: ["EXPENSE", "DEBT_LEND"] },
        recordedAt: { gte: thirtyDaysAgo },
      },
      _sum: { amount: true },
    }),
    prisma.debtRecord.aggregate({
      where: { userId, direction: "WE_LENT", isPaid: false },
      _sum: { originalAmt: true },
    }),
    prisma.subscription.findMany({
      where: { userId, isActive: true },
      select: { name: true, amount: true, billingDay: true },
      orderBy: { billingDay: "asc" },
    }),
  ]);

  const totalBalance = accounts.reduce(
    (s, a) => s.plus(a.balance),
    new Prisma.Decimal(0)
  );

  const avgExpense = recentExpenses._sum.amount ?? new Prisma.Decimal(0);
  const totalDebt = pendingDebts._sum?.originalAmt ?? new Prisma.Decimal(0);

  const today = new Date().getDate();
  const upcoming = upcomingBills
    .map((s) => {
      const daysLeft = s.billingDay >= today
        ? s.billingDay - today
        : 30 - today + s.billingDay;
      return `${s.name} ฿${Number(s.amount).toLocaleString("th-TH")} (อีก ${daysLeft} วัน)`;
    })
    .join(", ");

  const mainWallet = accounts.find((a) => a.isDefault);
  const mainWalletBalance = mainWallet?.balance ?? new Prisma.Decimal(0);
  const mainWalletStatus = Number(mainWalletBalance) < 0
    ? `ติดลบ ฿${Math.abs(Number(mainWalletBalance)).toLocaleString("th-TH")} ⚠️ สภาพคล่องมีปัญหา`
    : `฿${Number(mainWalletBalance).toLocaleString("th-TH")} (ปกติ)`;

  const accountLines = accounts
    .map((a) => `${a.name}${a.isDefault ? " [กระเป๋าหลัก]" : ""}: ฿${Number(a.balance).toLocaleString("th-TH")}`)
    .join(", ");

  return `[ข้อมูลการเงินปัจจุบัน]
ยอดเงินรวม: ฿${Number(totalBalance).toLocaleString("th-TH")}
กระเป๋าหลัก: ${mainWalletStatus}
บัญชีทั้งหมด: ${accountLines}
รายจ่าย 30 วันที่ผ่านมา: ฿${Number(avgExpense).toLocaleString("th-TH")}
หนี้ที่ให้ยืมค้างอยู่: ฿${Number(totalDebt).toLocaleString("th-TH")}
บิลที่จะถึงเร็วๆ นี้: ${upcoming || "ไม่มี"}`;
}

export async function runBudgetCheck(userId: string, userMessage: string): Promise<string> {
  const context = await buildBudgetContext(userId);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `${context}\n\n[คำถามของผู้ใช้]\n${userMessage}`,
      },
    ],
  });

  const block = response.content[0];
  return block.type === "text" ? block.text : "ขอโทษงับ Cooper ตอบไม่ได้ตอนนี้ ลองใหม่อีกครั้งนะงับ 🐾";
}
