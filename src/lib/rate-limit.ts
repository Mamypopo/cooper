import { prisma } from "@/lib/prisma";

const WINDOW_MS = 3000; // ป้องกัน double-send ภายใน 3 วินาที

export async function isRecordRateLimited(userId: string): Promise<boolean> {
  const latest = await prisma.transaction.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!latest) return false;
  return Date.now() - latest.createdAt.getTime() < WINDOW_MS;
}
