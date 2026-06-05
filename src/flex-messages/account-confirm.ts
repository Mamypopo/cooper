import type { messagingApi } from "@line/bot-sdk";
import { Prisma } from "@prisma/client";

export function buildAccountConfirmFlex(params: {
  name: string;
  balance: Prisma.Decimal;
  isNew: boolean;
}): messagingApi.FlexContainer {
  const { name, balance, isNew } = params;
  const balanceStr = `฿${Number(balance).toLocaleString("th-TH")}`;
  const action = isNew ? "เพิ่มบัญชีใหม่แล้วงับ" : "อัปเดตยอดแล้วงับ";

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
          alignItems: "center",
          justifyContent: "space-between",
          contents: [
            { type: "text", text: name, weight: "bold", size: "lg", color: "#2C2C2E" },
            {
              type: "box",
              layout: "vertical",
              paddingAll: "3px",
              paddingStart: "10px",
              paddingEnd: "10px",
              backgroundColor: "#EAF0F6",
              cornerRadius: "20px",
              contents: [
                { type: "text", text: isNew ? "NEW" : "UPDATED", size: "xxs", weight: "bold", color: "#6B8296" },
              ],
            },
          ],
        },
        {
          type: "text",
          text: balanceStr,
          size: "xxl",
          weight: "bold",
          color: "#7EA184",
          margin: "md",
        },
        { type: "separator", margin: "md", color: "#E5E5EA" },
        {
          type: "text",
          text: "พิมพ์ 'ดูบัญชี' เพื่อดูทุกกระเป๋าได้เลยงับ",
          size: "xs",
          color: "#8E8E93",
          margin: "md",
          wrap: true,
        },
      ],
    },
    footer: {
      type: "box",
      layout: "horizontal",
      backgroundColor: "#F5F5F7",
      paddingAll: "10px",
      contents: [
        { type: "text", text: `🐾  Cooper ${action}`, size: "xs", color: "#8E8E93" },
      ],
    },
  };
}
