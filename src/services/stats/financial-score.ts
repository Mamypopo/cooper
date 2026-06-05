import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface WeeklyStats {
  totalIncome: number;
  totalExpense: number;
  savingsRate: number;        // % ที่ออมจากรายรับ
  billsPaidOnTime: boolean;   // จ่ายบิลครบสัปดาห์นี้ไหม
  debtCount: number;          // หนี้ค้างจำนวนกี่รายการ
  topCategory: string;        // หมวดที่ใช้เงินเยอะสุด
  netChange: number;          // ยอดรวมเพิ่ม/ลด
  budgetScore: number;        // 0-100: ใช้จ่ายอยู่ในงบไหม
  liquidityScore: number;     // 0-100: กระเป๋าหลักสุขภาพดีไหม
  grade: "A" | "B+" | "B" | "C+" | "C" | "D";
}

function calcGrade(savingsRate: number, debtCount: number, expense: number, income: number): WeeklyStats["grade"] {
  let score = 100;
  if (savingsRate < 0.1)  score -= 30;
  else if (savingsRate < 0.2) score -= 15;
  if (debtCount > 3)  score -= 20;
  else if (debtCount > 0) score -= 10;
  if (income > 0 && expense / income > 0.9) score -= 20;
  else if (income > 0 && expense / income > 0.7) score -= 10;

  if (score >= 90) return "A";
  if (score >= 80) return "B+";
  if (score >= 70) return "B";
  if (score >= 60) return "C+";
  if (score >= 50) return "C";
  return "D";
}

export async function calcWeeklyStats(userId: string): Promise<WeeklyStats> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [txs, debtCount, settings, defaultAccount, expense30d] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, recordedAt: { gte: sevenDaysAgo } },
    }),
    prisma.debtRecord.count({ where: { userId, isPaid: false } }),
    prisma.userSettings.findUnique({ where: { userId }, select: { monthlyBudget: true } }),
    prisma.account.findFirst({ where: { userId, isDefault: true, isActive: true }, select: { balance: true } }),
    prisma.transaction.aggregate({
      where: { userId, type: "EXPENSE", recordedAt: { gte: thirtyDaysAgo } },
      _sum: { amount: true },
    }),
  ]);

  const totalIncome = txs
    .filter((t) => t.type === "INCOME")
    .reduce((s, t) => s + Number(t.amount), 0);

  const totalExpense = txs
    .filter((t) => t.type === "EXPENSE")
    .reduce((s, t) => s + Number(t.amount), 0);

  const savingsRate = totalIncome > 0
    ? Math.max(0, (totalIncome - totalExpense) / totalIncome)
    : 0;

  // หมวดรายจ่ายที่ใช้เยอะสุด
  const categoryMap: Record<string, number> = {};
  txs.filter((t) => t.type === "EXPENSE").forEach((t) => {
    categoryMap[t.category] = (categoryMap[t.category] ?? 0) + Number(t.amount);
  });
  const topCategory = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "ไม่มีข้อมูล";

  const netChange = totalIncome - totalExpense;
  const grade = calcGrade(savingsRate, debtCount, totalExpense, totalIncome);

  // budgetScore — เทียบรายจ่าย 30 วันกับงบที่ตั้งไว้
  const monthlyBudget = settings?.monthlyBudget ? Number(settings.monthlyBudget) : null;
  const totalExpense30d = Number(expense30d._sum.amount ?? 0);
  const budgetScore = monthlyBudget && monthlyBudget > 0
    ? Math.max(0, Math.round(100 - (totalExpense30d / monthlyBudget) * 100))
    : 50;

  // liquidityScore — กระเป๋าหลักเทียบกับรายจ่ายเฉลี่ยต่อเดือน
  const walletBalance = Number(defaultAccount?.balance ?? 0);
  const liquidityRatio = totalExpense30d > 0 ? walletBalance / totalExpense30d : 1;
  const liquidityScore = walletBalance < 0 ? 0
    : liquidityRatio >= 2   ? 100
    : liquidityRatio >= 1   ? 75
    : liquidityRatio >= 0.5 ? 50
    : 25;

  return {
    totalIncome,
    totalExpense,
    savingsRate: Math.round(savingsRate * 100),
    billsPaidOnTime: true,
    debtCount,
    topCategory,
    netChange,
    budgetScore,
    liquidityScore,
    grade,
  };
}
