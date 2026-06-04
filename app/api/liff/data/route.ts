import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcWeeklyStats } from "@/services/stats/financial-score";

export async function GET(req: NextRequest) {
  const lineUserId = req.nextUrl.searchParams.get("lineUserId");
  if (!lineUserId) {
    return NextResponse.json({ error: "lineUserId required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { lineUserId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [accounts, transactions, debts, subscriptions, weeklyStats] = await Promise.all([
    prisma.account.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }),
    prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { recordedAt: "desc" },
      take: 10,
      include: { account: { select: { name: true } } },
    }),
    prisma.debtRecord.findMany({
      where: { userId: user.id, isPaid: false },
      orderBy: { createdAt: "desc" },
    }),
    prisma.subscription.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { billingDay: "asc" },
    }),
    calcWeeklyStats(user.id),
  ]);

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);

  return NextResponse.json({
    accounts: accounts.map((a) => ({
      name: a.name,
      balance: Number(a.balance),
      type: a.type,
      isDefault: a.isDefault,
    })),
    transactions: transactions.map((t) => ({
      note: t.note,
      category: t.category,
      type: t.type,
      amount: Number(t.amount),
      accountName: t.account.name,
      recordedAt: t.recordedAt,
    })),
    debts: debts.map((d) => ({
      personName: d.personName,
      direction: d.direction,
      remaining: Number(d.originalAmt) - Number(d.paidAmt),
      daysAgo: Math.floor((Date.now() - d.createdAt.getTime()) / 86400000),
    })),
    subscriptions: subscriptions.map((s) => {
      const today = new Date().getDate();
      const daysLeft = s.billingDay >= today ? s.billingDay - today : 30 - today + s.billingDay;
      return { name: s.name, amount: Number(s.amount), billingDay: s.billingDay, daysLeft };
    }),
    totalBalance,
    weeklyStats,
  });
}
