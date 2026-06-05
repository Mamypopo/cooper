import type { messagingApi } from "@line/bot-sdk";
import type { RecentTransaction } from "@/services/queries/transactions";

const TYPE_SIGN: Record<string, string> = {
  INCOME: "+", EXPENSE: "-", TRANSFER: "", DEBT_LEND: "-", DEBT_BORROW: "+", DEBT_REPAY: "+",
};

const TYPE_COLOR: Record<string, string> = {
  INCOME: "#7EA184", EXPENSE: "#C58B7E",
  TRANSFER: "#6B8296", DEBT_LEND: "#9B8DB4", DEBT_BORROW: "#C58B7E", DEBT_REPAY: "#7EA184",
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
        type: "box", layout: "vertical", paddingAll: "18px",
        contents: [
          { type: "text", text: "ยังไม่มีรายการงับ", weight: "bold", size: "md", color: "#2C2C2E" },
          { type: "text", text: "ลองพิมพ์ 'กาแฟ 65' เพื่อเริ่มบันทึกได้เลยงับ 🐾", size: "sm", color: "#8E8E93", margin: "sm", wrap: true },
        ],
      },
    };
  }

  const rows: messagingApi.FlexComponent[] = txs.map((t) => {
    const sign = TYPE_SIGN[t.type] ?? "";
    const color = TYPE_COLOR[t.type] ?? "#2C2C2E";
    const label = t.note || t.category;

    return {
      type: "box", layout: "horizontal", paddingTop: "8px", paddingBottom: "8px",
      borderColor: "#F2F2F7", borderWidth: "1px",
      contents: [
        {
          type: "box", layout: "vertical", flex: 1,
          contents: [
            { type: "text", text: label, size: "sm", weight: "bold", color: "#2C2C2E", wrap: false },
            { type: "text", text: `${t.category} · ${t.accountName}`, size: "xxs", color: "#8E8E93", margin: "xs" },
          ],
        },
        {
          type: "box", layout: "vertical", flex: 0, alignItems: "flex-end",
          contents: [
            { type: "text", text: `${sign}฿${Number(t.amount).toLocaleString("th-TH")}`, size: "sm", weight: "bold", color, align: "end" },
            { type: "text", text: formatDate(t.recordedAt), size: "xxs", color: "#AEAEB2", align: "end", margin: "xs" },
          ],
        },
      ],
    };
  });

  return {
    type: "bubble",
    body: {
      type: "box", layout: "vertical", paddingAll: "18px",
      contents: [
        { type: "text", text: "รายการล่าสุด", weight: "bold", size: "md", color: "#2C2C2E" },
        { type: "separator", margin: "md", color: "#E5E5EA" },
        { type: "box", layout: "vertical", margin: "md", contents: rows },
      ],
    },
    footer: {
      type: "box", layout: "horizontal", backgroundColor: "#F5F5F7", paddingAll: "10px",
      contents: [{ type: "text", text: "🐾  Cooper บันทึกให้ทุกรายการงับ", size: "xs", color: "#8E8E93" }],
    },
  };
}
