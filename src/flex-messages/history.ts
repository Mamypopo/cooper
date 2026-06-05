import type { messagingApi } from "@line/bot-sdk";
import type { RecentTransaction } from "@/services/queries/transactions";

const TYPE_SIGN: Record<string, string> = {
  INCOME: "+", EXPENSE: "-", TRANSFER: "", DEBT_LEND: "-", DEBT_BORROW: "+", DEBT_REPAY: "+",
};

const TYPE_COLOR: Record<string, string> = {
  INCOME: "#7EA184", EXPENSE: "#C58B7E",
  TRANSFER: "#6B8296", DEBT_LEND: "#9B8DB4", DEBT_BORROW: "#C58B7E", DEBT_REPAY: "#7EA184",
};

const TYPE_LABEL: Record<string, string> = {
  INCOME: "รายรับ", EXPENSE: "รายจ่าย", TRANSFER: "โอน",
  DEBT_LEND: "ให้ยืม", DEBT_BORROW: "ยืมเงิน", DEBT_REPAY: "คืนเงิน",
};

const TYPE_BG: Record<string, string> = {
  INCOME: "#EAF0EB", EXPENSE: "#F7ECE9", TRANSFER: "#EAF0F6",
  DEBT_LEND: "#F0EDF7", DEBT_BORROW: "#F7ECE9", DEBT_REPAY: "#EAF0EB",
};

function formatDate(d: Date): string {
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" }) +
    " " + d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

export function buildHistoryFlex(txs: RecentTransaction[]): messagingApi.FlexContainer {
  if (txs.length === 0) {
    return {
      type: "bubble",
      body: {
        type: "box", layout: "vertical", paddingAll: "20px",
        contents: [
          { type: "text", text: "ยังไม่มีรายการงับ", weight: "bold", size: "md", color: "#2C2C2E" },
          { type: "text", text: "ลองพิมพ์ 'กาแฟ 65' เพื่อเริ่มบันทึกได้เลยงับ", size: "sm", color: "#8E8E93", margin: "sm", wrap: true },
        ],
      },
    };
  }

  const rows: messagingApi.FlexComponent[] = [];

  txs.forEach((t, i) => {
    const sign = TYPE_SIGN[t.type] ?? "";
    const color = TYPE_COLOR[t.type] ?? "#2C2C2E";
    const label = TYPE_LABEL[t.type] ?? t.type;
    const bg = TYPE_BG[t.type] ?? "#F5F5F7";
    const title = t.note || t.category;

    if (i > 0) {
      rows.push({ type: "separator", color: "#F2F2F7" });
    }

    rows.push({
      type: "box",
      layout: "horizontal",
      paddingTop: "12px",
      paddingBottom: "12px",
      contents: [
        // Badge แสดง type
        {
          type: "box",
          layout: "vertical",
          width: "48px",
          alignItems: "center",
          justifyContent: "center",
          contents: [
            {
              type: "box",
              layout: "vertical",
              backgroundColor: bg,
              cornerRadius: "8px",
              paddingAll: "6px",
              width: "36px",
              height: "36px",
              alignItems: "center",
              justifyContent: "center",
              contents: [
                { type: "text", text: sign || "→", size: "md", weight: "bold", color, align: "center" },
              ],
            },
          ],
        },
        // รายละเอียด
        {
          type: "box",
          layout: "vertical",
          flex: 1,
          paddingStart: "8px",
          contents: [
            { type: "text", text: title, size: "sm", weight: "bold", color: "#2C2C2E", wrap: true, maxLines: 2 },
            {
              type: "box",
              layout: "horizontal",
              margin: "xs",
              contents: [
                {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: bg,
                  cornerRadius: "20px",
                  paddingTop: "2px",
                  paddingBottom: "2px",
                  paddingStart: "8px",
                  paddingEnd: "8px",
                  contents: [
                    { type: "text", text: label, size: "xxs", color, weight: "bold" },
                  ],
                },
                { type: "text", text: `· ${t.accountName}`, size: "xxs", color: "#AEAEB2", margin: "sm", flex: 1 },
              ],
            },
          ],
        },
        // ยอดเงิน + วันเวลา
        {
          type: "box",
          layout: "vertical",
          alignItems: "flex-end",
          contents: [
            { type: "text", text: `${sign}฿${Number(t.amount).toLocaleString("th-TH")}`, size: "sm", weight: "bold", color, align: "end" },
            { type: "text", text: formatDate(t.recordedAt), size: "xxs", color: "#AEAEB2", align: "end", margin: "xs" },
          ],
        },
      ],
    });
  });

  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "0px",
      backgroundColor: "#FFFFFF",
      contents: [
        {
          type: "box",
          layout: "vertical",
          paddingTop: "16px",
          paddingBottom: "0px",
          paddingStart: "16px",
          paddingEnd: "16px",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              paddingBottom: "12px",
              contents: [
                { type: "text", text: "รายการล่าสุด", weight: "bold", size: "md", color: "#2C2C2E" },
                { type: "text", text: `${txs.length} รายการ`, size: "xs", color: "#8E8E93", align: "end", gravity: "bottom" },
              ],
            },
            { type: "separator", color: "#E5E5EA" },
          ],
        },
        {
          type: "box",
          layout: "vertical",
          paddingStart: "16px",
          paddingEnd: "16px",
          paddingBottom: "8px",
          contents: rows,
        },
      ],
    },
    footer: {
      type: "box",
      layout: "horizontal",
      backgroundColor: "#F5F5F7",
      paddingAll: "10px",
      contents: [
        { type: "text", text: "🐾  Cooper บันทึกให้ทุกรายการงับ", size: "xs", color: "#8E8E93" },
      ],
    },
  };
}
