import type { messagingApi } from "@line/bot-sdk";
import type { SubscriptionResult } from "@/services/subscriptions/manage";

export function buildSubscriptionConfirmFlex(sub: SubscriptionResult): messagingApi.FlexContainer {
  const amountStr = `฿${Number(sub.amount).toLocaleString("th-TH")}`;
  const action = sub.isNew ? "เพิ่มบิลใหม่แล้วงับ" : "อัปเดตบิลแล้วงับ";

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
            { type: "text", text: sub.name, weight: "bold", size: "lg", color: "#2C2C2E" },
            {
              type: "box",
              layout: "vertical",
              paddingAll: "3px", paddingStart: "10px", paddingEnd: "10px",
              backgroundColor: "#EAF0F6", cornerRadius: "20px",
              contents: [{ type: "text", text: sub.isNew ? "NEW" : "UPDATED", size: "xxs", weight: "bold", color: "#6B8296" }],
            },
          ],
        },
        { type: "text", text: amountStr, size: "xxl", weight: "bold", color: "#C58B7E", margin: "md" },
        { type: "separator", margin: "md", color: "#E5E5EA" },
        {
          type: "box", layout: "horizontal", margin: "md",
          contents: [
            { type: "text", text: "ครบรอบวันที่", size: "sm", color: "#8E8E93", flex: 2 },
            { type: "text", text: `${sub.billingDay} ของทุกเดือน`, size: "sm", weight: "bold", align: "end", flex: 3 },
          ],
        },
        {
          type: "text",
          text: "พิมพ์ 'ดูบิล' เพื่อดูรอบบิลทั้งหมดได้เลยงับ",
          size: "xs", color: "#8E8E93", margin: "md", wrap: true,
        },
      ],
    },
    footer: {
      type: "box", layout: "horizontal", backgroundColor: "#F5F5F7", paddingAll: "10px",
      contents: [{ type: "text", text: `🐾  Cooper ${action}`, size: "xs", color: "#8E8E93" }],
    },
  };
}
