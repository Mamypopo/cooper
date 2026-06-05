import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const lineUserId = req.nextUrl.searchParams.get("lineUserId");
  if (!lineUserId) return NextResponse.json({ error: "lineUserId required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { lineUserId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } });
  return NextResponse.json({
    monthlyBudget: settings?.monthlyBudget ? Number(settings.monthlyBudget) : null,
    alertDaysBefore: settings?.alertDaysBefore ?? 3,
    enableSubAlert: settings?.enableSubAlert ?? true,
    enableDebtAlert: settings?.enableDebtAlert ?? true,
  });
}

export async function PUT(req: NextRequest) {
  const lineUserId = req.nextUrl.searchParams.get("lineUserId");
  if (!lineUserId) return NextResponse.json({ error: "lineUserId required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { lineUserId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {
      monthlyBudget: body.monthlyBudget ?? null,
      alertDaysBefore: Math.max(1, Math.min(30, body.alertDaysBefore ?? 3)),
      enableSubAlert: body.enableSubAlert ?? true,
      enableDebtAlert: body.enableDebtAlert ?? true,
    },
    create: {
      userId: user.id,
      monthlyBudget: body.monthlyBudget ?? null,
      alertDaysBefore: Math.max(1, Math.min(30, body.alertDaysBefore ?? 3)),
      enableSubAlert: body.enableSubAlert ?? true,
      enableDebtAlert: body.enableDebtAlert ?? true,
    },
  });

  return NextResponse.json({ ok: true });
}
