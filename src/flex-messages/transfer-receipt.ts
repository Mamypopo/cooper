import type { messagingApi } from "@line/bot-sdk";
import { Prisma } from "@prisma/client";

function formatBalance(bal: Prisma.Decimal): string {
  return `฿${Number(bal).toLocaleString("th-TH", { minimumFractionDigits: 0 })}`;
}

export function buildTransferReceiptFlex(params: {
  amount: number;
  fromAccount: { name: string; newBalance: Prisma.Decimal };
  toAccount: { name: string; newBalance: Prisma.Decimal };
}): messagingApi.FlexContainer {
  const { amount, fromAccount, toAccount } = params;
  const amountStr = `฿${amount.toLocaleString("th-TH")}`;

  return {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "18px",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          justifyContent: "space-between",
          alignItems: "center",
          contents: [
            { type: "text", text: "โอนเงิน", weight: "bold", size: "md", color: "#2C2C2E" },
            {
              type: "box",
              layout: "vertical",
              paddingAll: "3px",
              paddingStart: "10px",
              paddingEnd: "10px",
              backgroundColor: "#EAF0F6",
              cornerRadius: "20px",
              contents: [
                { type: "text", text: "TRANSFER", size: "xxs", weight: "bold", color: "#6B8296" },
              ],
            },
          ],
        },
        { type: "text", text: amountStr, size: "xxl", weight: "bold", color: "#6B8296", margin: "md" },
        { type: "separator", margin: "md", color: "#E5E5EA" },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "xs",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "จาก", size: "sm", color: "#8E8E93", flex: 2 },
                { type: "text", text: fromAccount.name, size: "sm", weight: "bold", align: "end", flex: 3 },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "ไป", size: "sm", color: "#8E8E93", flex: 2 },
                { type: "text", text: toAccount.name, size: "sm", weight: "bold", align: "end", flex: 3 },
              ],
            },
            { type: "separator", margin: "sm", color: "#E5E5EA" },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: `คงเหลือ (${fromAccount.name})`, size: "sm", color: "#8E8E93", flex: 3 },
                { type: "text", text: formatBalance(fromAccount.newBalance), size: "sm", weight: "bold", color: "#C58B7E", align: "end", flex: 2 },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: `คงเหลือ (${toAccount.name})`, size: "sm", color: "#8E8E93", flex: 3 },
                { type: "text", text: formatBalance(toAccount.newBalance), size: "sm", weight: "bold", color: "#7EA184", align: "end", flex: 2 },
              ],
            },
          ],
        },
      ],
    },
    footer: {
      type: "box",
      layout: "horizontal",
      backgroundColor: "#F5F5F7",
      paddingAll: "10px",
      contents: [
        { type: "text", text: "🐾  Cooper บันทึกให้แล้วงับ", size: "xs", color: "#8E8E93" },
      ],
    },
  };
}
