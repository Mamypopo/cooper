import type { messagingApi } from "@line/bot-sdk";
import type { Subscription } from "@prisma/client";

export function buildSubscriptionListFlex(subs: Subscription[]): messagingApi.FlexContainer {
  const today = new Date().getDate();

  if (subs.length === 0) {
    return {
      type: "bubble",
      body: {
        type: "box", layout: "vertical", paddingAll: "18px",
        contents: [
          { type: "text", text: "ยังไม่มีรอบบิลงับ", weight: "bold", size: "md", color: "#2C2C2E" },
          { type: "text", text: "พิมพ์ 'เพิ่มบิล Netflix 299 วันที่ 15' เพื่อเพิ่มได้เลยงับ 🐾", size: "sm", color: "#8E8E93", margin: "sm", wrap: true },
        ],
      },
    };
  }

  const rows: messagingApi.FlexComponent[] = subs.map((s) => {
    const daysLeft = s.billingDay >= today
      ? s.billingDay - today
      : 30 - today + s.billingDay;

    const urgentColor = daysLeft <= 3 ? "#C58B7E" : "#8E8E93";
    const daysText = daysLeft === 0 ? "วันนี้!" : `อีก ${daysLeft} วัน`;

    return {
      type: "box", layout: "horizontal", paddingTop: "8px", paddingBottom: "8px",
      contents: [
        {
          type: "box", layout: "vertical", flex: 1,
          contents: [
            { type: "text", text: s.name, size: "sm", weight: "bold", color: "#2C2C2E" },
            { type: "text", text: `วันที่ ${s.billingDay} ทุกเดือน`, size: "xxs", color: "#8E8E93", margin: "xs" },
          ],
        },
        {
          type: "box", layout: "vertical", flex: 0, alignItems: "flex-end",
          contents: [
            { type: "text", text: `฿${Number(s.amount).toLocaleString("th-TH")}`, size: "sm", weight: "bold", color: "#C58B7E", align: "end" },
            { type: "text", text: daysText, size: "xxs", color: urgentColor, align: "end", margin: "xs" },
          ],
        },
      ],
    };
  });

  const totalAmount = subs.reduce((s, sub) => s + Number(sub.amount), 0);

  return {
    type: "bubble",
    body: {
      type: "box", layout: "vertical", paddingAll: "18px",
      contents: [
        { type: "text", text: "รอบบิลประจำ", weight: "bold", size: "md", color: "#2C2C2E" },
        { type: "text", text: `รวม ฿${totalAmount.toLocaleString("th-TH")}/เดือน`, size: "xs", color: "#8E8E93", margin: "xs" },
        { type: "separator", margin: "md", color: "#E5E5EA" },
        { type: "box", layout: "vertical", margin: "md", contents: rows },
      ],
    },
    footer: {
      type: "box", layout: "horizontal", backgroundColor: "#F5F5F7", paddingAll: "10px",
      contents: [{ type: "text", text: "🐾  Cooper คอยเตือนก่อนถึงวันงับ", size: "xs", color: "#8E8E93" }],
    },
  };
}
