import type { messagingApi } from "@line/bot-sdk";
import type { DebtSummary } from "@/services/queries/debts";

export function buildDebtSummaryFlex(data: DebtSummary): messagingApi.FlexContainer {
  const hasData = data.lending.length > 0 || data.owing.length > 0;

  if (!hasData) {
    return {
      type: "bubble",
      body: {
        type: "box", layout: "vertical", paddingAll: "18px",
        contents: [
          { type: "text", text: "ไม่มีหนี้ค้างชำระงับ", weight: "bold", size: "md", color: "#2C2C2E" },
          { type: "text", text: "เยี่ยมมากเลยงับ Cooper ภูมิใจในตัวคุณมากเลย 🐾", size: "sm", color: "#8E8E93", margin: "sm", wrap: true },
        ],
      },
    };
  }

  const contents: messagingApi.FlexComponent[] = [
    { type: "text", text: "สรุปหนี้สิน", weight: "bold", size: "md", color: "#2C2C2E" },
  ];

  if (data.lending.length > 0) {
    contents.push(
      { type: "separator", margin: "md", color: "#E5E5EA" },
      { type: "text", text: `คนอื่นค้างเรา  ฿${Number(data.totalLending).toLocaleString("th-TH")}`, size: "sm", weight: "bold", color: "#7EA184", margin: "md" },
      ...data.lending.map((d): messagingApi.FlexComponent => ({
        type: "box", layout: "horizontal", margin: "sm",
        contents: [
          { type: "text", text: d.personName, size: "sm", color: "#2C2C2E", flex: 1 },
          { type: "text", text: `฿${Number(d.amount).toLocaleString("th-TH")}`, size: "sm", weight: "bold", color: "#7EA184", align: "end" },
          { type: "text", text: `${d.daysAgo}ว.`, size: "xxs", color: "#AEAEB2", align: "end", margin: "sm" },
        ],
      }))
    );
  }

  if (data.owing.length > 0) {
    contents.push(
      { type: "separator", margin: "md", color: "#E5E5EA" },
      { type: "text", text: `เราค้างคนอื่น  ฿${Number(data.totalOwing).toLocaleString("th-TH")}`, size: "sm", weight: "bold", color: "#C58B7E", margin: "md" },
      ...data.owing.map((d): messagingApi.FlexComponent => ({
        type: "box", layout: "horizontal", margin: "sm",
        contents: [
          { type: "text", text: d.personName, size: "sm", color: "#2C2C2E", flex: 1 },
          { type: "text", text: `฿${Number(d.amount).toLocaleString("th-TH")}`, size: "sm", weight: "bold", color: "#C58B7E", align: "end" },
        ],
      }))
    );
  }

  return {
    type: "bubble",
    body: { type: "box", layout: "vertical", paddingAll: "18px", contents },
    footer: {
      type: "box", layout: "horizontal", backgroundColor: "#F5F5F7", paddingAll: "10px",
      contents: [{ type: "text", text: "🐾  Cooper คอยติดตามให้เสมองับ", size: "xs", color: "#8E8E93" }],
    },
  };
}
