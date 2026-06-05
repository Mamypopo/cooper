import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const discount = await prisma.discountCode.findFirst({
    where: { code, isActive: true },
  });

  if (!discount) return NextResponse.json({ valid: false });
  if (discount.expiresAt && discount.expiresAt < new Date()) return NextResponse.json({ valid: false });
  if (discount.usageLimit !== null && discount.usedCount >= discount.usageLimit) return NextResponse.json({ valid: false });

  await prisma.discountCode.update({
    where: { id: discount.id },
    data: { usedCount: { increment: 1 } },
  });

  return NextResponse.json({ valid: true, discount: discount.discount, code: discount.code });
}
