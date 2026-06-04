import { prisma } from "@/lib/prisma";
import { anthropic, SYSTEM_PROMPT } from "@/lib/claude";
import { pushText } from "@/lib/line";

interface AlertData {
  userId: string;
  lineUserId: string;
  upcomingBills: { name: string; amount: number; daysLeft: number }[];
  pendingDebts: { personName: string; amount: number; daysAgo: number }[];
}

async function buildAlertData(): Promise<AlertData[]> {
  const today = new Date().getDate();

  const users = await prisma.user.findMany({
    include: {
      settings: true,
      subscriptions: { where: { isActive: true } },
      debts: { where: { isPaid: false, direction: "WE_LENT" } },
    },
  });

  return users
    .map((user) => {
      const alertDays = user.settings?.alertDaysBefore ?? 3;
      const enableSub = user.settings?.enableSubAlert ?? true;
      const enableDebt = user.settings?.enableDebtAlert ?? true;

      const upcomingBills = enableSub
        ? user.subscriptions
            .map((s) => {
              const daysLeft =
                s.billingDay >= today
                  ? s.billingDay - today
                  : 30 - today + s.billingDay;
              return { name: s.name, amount: Number(s.amount), daysLeft };
            })
            .filter((s) => s.daysLeft <= alertDays)
        : [];

      const pendingDebts = enableDebt
        ? user.debts.map((d) => ({
            personName: d.personName,
            amount: Number(d.originalAmt) - Number(d.paidAmt),
            daysAgo: Math.floor(
              (Date.now() - d.createdAt.getTime()) / 86400000
            ),
          }))
        : [];

      return { userId: user.id, lineUserId: user.lineUserId, upcomingBills, pendingDebts };
    })
    .filter((u) => u.upcomingBills.length > 0 || u.pendingDebts.length > 0);
}

async function writeAlertMessage(data: Omit<AlertData, "userId" | "lineUserId">): Promise<string> {
  const billLines = data.upcomingBills
    .map((b) => `- ${b.name} ฿${b.amount.toLocaleString("th-TH")} (อีก ${b.daysLeft} วัน)`)
    .join("\n");

  const debtLines = data.pendingDebts
    .map((d) => `- ${d.personName} ฿${d.amount.toLocaleString("th-TH")} (ค้างมา ${d.daysAgo} วัน)`)
    .join("\n");

  const context = [
    data.upcomingBills.length > 0 ? `บิลที่จะถึงเร็วๆ นี้:\n${billLines}` : "",
    data.pendingDebts.length > 0 ? `หนี้ที่ยังไม่ได้รับคืน:\n${debtLines}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `[REPORT MODE — morning alert]\nเขียนข้อความทักทายตอนเช้าสั้นๆ อบอุ่น แจ้งรายการด้านล่างนี้ให้ผู้ใช้ทราบ ห้ามใช้ Markdown\n\n${context}`,
      },
    ],
  });

  const block = response.content[0];
  return block.type === "text" ? block.text : "สวัสดีตอนเช้างับ 🐾 Cooper ขอแจ้งเตือนด้วยนะงับ";
}

export async function runMorningAlert(): Promise<{ sent: number }> {
  const targets = await buildAlertData();
  let sent = 0;

  for (const target of targets) {
    try {
      const message = await writeAlertMessage({
        upcomingBills: target.upcomingBills,
        pendingDebts: target.pendingDebts,
      });
      await pushText(target.lineUserId, message);
      sent++;
    } catch (err) {
      console.error(`[morning-alert] failed for ${target.lineUserId}:`, err);
    }
  }

  return { sent };
}
