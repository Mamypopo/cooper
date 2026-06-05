import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface SetupAccountResult {
  name: string;
  balance: Prisma.Decimal;
  isNew: boolean;
}

export async function setupAccount(
  userId: string,
  name: string,
  balance: number
): Promise<SetupAccountResult | null> {
  try {
    const amount = new Prisma.Decimal(balance);

    const existing = await prisma.account.findFirst({
      where: { userId, name: { equals: name, mode: "insensitive" }, isActive: true },
    });

    if (existing) {
      const updated = await prisma.account.update({
        where: { id: existing.id },
        data: { balance: amount },
      });
      return { name: updated.name, balance: updated.balance, isNew: false };
    }

    // ถ้าเป็นบัญชีแรก ตั้งเป็น default
    const accountCount = await prisma.account.count({ where: { userId, isActive: true } });

    const created = await prisma.account.create({
      data: {
        userId,
        name,
        balance: amount,
        isDefault: accountCount === 0,
        type: "WALLET",
      },
    });

    return { name: created.name, balance: created.balance, isNew: true };
  } catch {
    return null;
  }
}

export interface RenameAccountResult {
  oldName: string;
  newName: string;
}

export async function renameAccount(
  userId: string,
  oldName: string,
  newName: string
): Promise<RenameAccountResult | null> {
  try {
    const account = await prisma.account.findFirst({
      where: { userId, name: { contains: oldName, mode: "insensitive" }, isActive: true },
    });
    if (!account) return null;

    const updated = await prisma.account.update({
      where: { id: account.id },
      data: { name: newName.trim() },
    });
    return { oldName: account.name, newName: updated.name };
  } catch {
    return null;
  }
}

// "เปลี่ยนชื่อบัญชี กสิกร เป็น KBank" / "แก้ชื่อบัญชี กสิกร เป็น KBank"
export function parseRenameAccountCommand(text: string): { oldName: string; newName: string } | null {
  const m = text.match(/(?:เปลี่ยนชื่อบัญชี|แก้ชื่อบัญชี|เปลี่ยนชื่อ)\s+(.+?)\s+เป็น\s+(.+)/i);
  if (!m) return null;
  const oldName = m[1].trim();
  const newName = m[2].trim();
  if (!oldName || !newName) return null;
  return { oldName, newName };
}

export function parseSetupCommand(text: string): { name: string; balance: number } | null {
  // รองรับ: "เพิ่มบัญชี กสิกร 12000" / "ตั้งยอด กสิกร 12000" / "บัญชี กสิกร 12000"
  const match = text.match(/(?:เพิ่มบัญชี|ตั้งยอด|บัญชี)\s+(.+?)\s+([\d,]+)/);
  if (!match) return null;

  const name = match[1].trim();
  const balance = parseInt(match[2].replace(/,/g, ""), 10);

  if (!name || isNaN(balance) || balance < 0) return null;
  return { name, balance };
}
