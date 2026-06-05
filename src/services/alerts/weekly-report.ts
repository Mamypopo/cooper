import { prisma } from "@/lib/prisma";
import { anthropic, BUDGET_REPORT_PROMPT } from "@/lib/claude";
import { pushText } from "@/lib/line";
import { calcWeeklyStats } from "@/services/stats/financial-score";

async function writeReportMessage(stats: Awaited<ReturnType<typeof calcWeeklyStats>>): Promise<string> {
  const context = `[REPORT MODE — weekly report]
สรุปสัปดาห์ที่ผ่านมา:
เกรด: ${stats.grade}
รายรับ: ฿${stats.totalIncome.toLocaleString("th-TH")}
รายจ่าย: ฿${stats.totalExpense.toLocaleString("th-TH")}
อัตราออม: ${stats.savingsRate}%
หมวดใช้เงินเยอะสุด: ${stats.topCategory}
หนี้ค้างชำระ: ${stats.debtCount} รายการ
ยอดสุทธิ: ${stats.netChange >= 0 ? "+" : ""}฿${stats.netChange.toLocaleString("th-TH")}

เขียนการ์ดรายงานสัปดาห์ในสไตล์ Cooper อบอุ่น ให้กำลังใจ ไม่ตัดสิน
ขึ้นต้นด้วยเกรด บอกจุดเด่น 1 ข้อ และจุดที่ควรปรับ 1 ข้อ ห้ามใช้ Markdown`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: [
      {
        type: "text",
        text: BUDGET_REPORT_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: context }],
  });

  const block = response.content[0];
  return block.type === "text" ? block.text : "สรุปสัปดาห์นี้เรียบร้อยแล้วงับ 🐾";
}

export async function runWeeklyReport(): Promise<{ sent: number }> {
  const users = await prisma.user.findMany({ select: { id: true, lineUserId: true } });
  let sent = 0;

  for (const user of users) {
    try {
      const stats = await calcWeeklyStats(user.id);
      const message = await writeReportMessage(stats);
      await pushText(user.lineUserId, message);
      sent++;
    } catch (err) {
      console.error(`[weekly-report] failed for ${user.lineUserId}:`, err);
    }
  }

  return { sent };
}
