import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdmin } from "@/lib/liff-auth";

export async function GET(req: NextRequest) {
  if (!await verifyAdmin(req.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const codes = await prisma.discountCode.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ codes });
}

export async function POST(req: NextRequest) {
  if (!await verifyAdmin(req.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { code, discount, usageLimit } = await req.json();
  if (!code || !discount) return NextResponse.json({ error: "code and discount required" }, { status: 400 });

  const result = await prisma.discountCode.upsert({
    where: { code: code.toUpperCase() },
    update: { discount, usageLimit: usageLimit ?? null, isActive: true, usedCount: 0 },
    create: { code: code.toUpperCase(), discount, usageLimit: usageLimit ?? null },
  });
  return NextResponse.json({ ok: true, code: result });
}

export async function DELETE(req: NextRequest) {
  if (!await verifyAdmin(req.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { code } = await req.json();
  await prisma.discountCode.updateMany({ where: { code }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
