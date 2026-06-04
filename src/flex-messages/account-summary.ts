import type { messagingApi } from "@line/bot-sdk";
import type { AccountSummary } from "@/services/queries/accounts";

const TYPE_ICON: Record<string, string> = {
  WALLET: "👛",
  SAVINGS: "🏦",
  INVESTMENT: "📈",
  CREDIT: "💳",
};

const TYPE_COLOR: Record<string, string> = {
  WALLET: "#7EA184",
  SAVINGS: "#6B8296",
  INVESTMENT: "#9B8DB4",
  CREDIT: "#C58B7E",
};

export function buildAccountSummaryFlex(data: AccountSummary): messagingApi.FlexContainer {
  const totalStr = `฿${Number(data.totalBalance).toLocaleString("th-TH")}`;

  const rows: messagingApi.FlexComponent[] = data.accounts.map((a) => ({
    type: "box",
    layout: "horizontal",
    paddingAll: "10px",
    backgroundColor: "#F9F9FB",
    cornerRadius: "8px",
    contents: [
      { type: "text", text: TYPE_ICON[a.type] ?? "💰", size: "md", flex: 0 },
      {
        type: "box", layout: "vertical", flex: 1, paddingStart: "10px",
        contents: [
          { type: "text", text: a.name, size: "sm", weight: "bold", color: "#2C2C2E" },
          { type: "text", text: a.type, size: "xxs", color: "#8E8E93" },
        ],
      },
      {
        type: "text",
        text: `฿${Number(a.balance).toLocaleString("th-TH")}`,
        size: "sm", weight: "bold",
        color: TYPE_COLOR[a.type] ?? "#2C2C2E",
        align: "end", flex: 0,
      },
    ],
  }));

  // แทรก separator ระหว่างแต่ละ row
  const contents: messagingApi.FlexComponent[] = [
    { type: "text", text: "กระเป๋าเงินทั้งหมด", weight: "bold", size: "md", color: "#2C2C2E" },
    { type: "text", text: totalStr, size: "xxl", weight: "bold", color: "#2C2C2E", margin: "sm" },
    { type: "separator", margin: "md", color: "#E5E5EA" },
    { type: "box", layout: "vertical", margin: "md", spacing: "sm", contents: rows },
  ];

  return {
    type: "bubble",
    body: { type: "box", layout: "vertical", paddingAll: "18px", contents },
    footer: {
      type: "box", layout: "horizontal", backgroundColor: "#F5F5F7", paddingAll: "10px",
      contents: [{ type: "text", text: "🐾  พิมพ์ 'ดูประวัติ' เพื่อดูรายการล่าสุดงับ", size: "xs", color: "#8E8E93" }],
    },
  };
}
