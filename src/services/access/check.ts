import { prisma } from "@/lib/prisma";

export type AccessStatus = "ALLOWED" | "PENDING" | "EXPIRED";

export async function checkAccess(userId: string): Promise<AccessStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, subscriptionEnds: true },
  });
  if (!user) return "PENDING";
  if (user.role === "ADMIN") return "ALLOWED";
  if (user.role === "SUBSCRIBER") {
    if (!user.subscriptionEnds) return "ALLOWED";
    return user.subscriptionEnds > new Date() ? "ALLOWED" : "EXPIRED";
  }
  return "PENDING";
}

export async function activateSubscriber(
  lineUserId: string,
  days: number
): Promise<{ displayName: string | null; subscriptionEnds: Date } | null> {
  const user = await prisma.user.findUnique({ where: { lineUserId } });
  if (!user) return null;

  const subscriptionEnds = new Date();
  subscriptionEnds.setDate(subscriptionEnds.getDate() + days);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: "SUBSCRIBER", subscriptionEnds },
  });
  return { displayName: updated.displayName, subscriptionEnds };
}

export async function suspendUser(
  lineUserId: string
): Promise<{ displayName: string | null } | null> {
  const user = await prisma.user.findUnique({ where: { lineUserId } });
  if (!user) return null;
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: "PENDING", subscriptionEnds: null },
  });
  return { displayName: updated.displayName };
}

export async function listSubscribers() {
  return prisma.user.findMany({
    where: { role: { in: ["SUBSCRIBER", "ADMIN"] } },
    select: { lineUserId: true, displayName: true, role: true, subscriptionEnds: true },
    orderBy: { createdAt: "desc" },
  });
}
