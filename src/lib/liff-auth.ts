import { prisma } from "@/lib/prisma";

export async function verifyLiffToken(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);

  const res = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;

  const profile = await res.json();
  return profile.userId ?? null;
}

export async function verifyAdmin(authHeader: string | null): Promise<boolean> {
  const lineUserId = await verifyLiffToken(authHeader);
  if (!lineUserId) return false;

  const user = await prisma.user.findUnique({
    where: { lineUserId },
    select: { role: true },
  });
  return user?.role === "ADMIN";
}
