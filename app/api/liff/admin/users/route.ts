import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdmin } from "@/lib/liff-auth";

export async function GET(req: NextRequest) {
  if (!await verifyAdmin(req.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    select: { id: true, lineUserId: true, displayName: true, role: true, subscriptionEnds: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const monthly = Number(process.env.NEXT_PUBLIC_PRICE_MONTHLY ?? 99);
  const yearly  = Number(process.env.NEXT_PUBLIC_PRICE_YEARLY  ?? 990);

  const activeCount = users.filter(u => u.role === "SUBSCRIBER" && (!u.subscriptionEnds || u.subscriptionEnds > new Date())).length;

  return NextResponse.json({ users, stats: { total: users.length, active: activeCount, estimatedRevenue: activeCount * monthly } });
}

export async function PUT(req: NextRequest) {
  if (!await verifyAdmin(req.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { targetLineUserId, action, days } = await req.json();
  const target = await prisma.user.findUnique({ where: { lineUserId: targetLineUserId } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (action === "activate") {
    const subscriptionEnds = new Date();
    subscriptionEnds.setDate(subscriptionEnds.getDate() + (days ?? 30));
    await prisma.user.update({ where: { id: target.id }, data: { role: "SUBSCRIBER", subscriptionEnds } });
  } else if (action === "suspend") {
    await prisma.user.update({ where: { id: target.id }, data: { role: "PENDING", subscriptionEnds: null } });
  }

  return NextResponse.json({ ok: true });
}
