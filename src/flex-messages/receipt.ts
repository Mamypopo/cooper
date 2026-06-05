import type { messagingApi } from "@line/bot-sdk";
import type { TransactionType } from "@/types/ai";
import { Prisma } from "@prisma/client";

const TYPE_LABEL: Record<TransactionType, string> = {
  INCOME:      "INCOME",
  EXPENSE:     "EXPENSE",
  TRANSFER:    "TRANSFER",
  DEBT_LEND:   "LEND",
  DEBT_BORROW: "BORROW",
  DEBT_REPAY:  "REPAY",
};

const TYPE_COLOR: Record<TransactionType, { text: string; bg: string }> = {
  INCOME:      { text: "#7EA184", bg: "#EAF0EB" },
  EXPENSE:     { text: "#C58B7E", bg: "#F7ECE9" },
  TRANSFER:    { text: "#6B8296", bg: "#EAF0F6" },
  DEBT_LEND:   { text: "#9B8DB4", bg: "#F0EDF7" },
  DEBT_BORROW: { text: "#C58B7E", bg: "#F7ECE9" },
  DEBT_REPAY:  { text: "#7EA184", bg: "#EAF0EB" },
};

const SIGN: Record<TransactionType, string> = {
  INCOME:      "+",
  EXPENSE:     "-",
  TRANSFER:    "",
  DEBT_LEND:   "-",
  DEBT_BORROW: "+",
  DEBT_REPAY:  "+",
};

function formatBalance(bal: Prisma.Decimal): string {
  return `฿${Number(bal).toLocaleString("th-TH", { minimumFractionDigits: 0 })}`;
}

export function buildReceiptFlex(params: {
  type: TransactionType;
  amount: number;
  note: string;
  category: string;
  accountName: string;
  newBalance: Prisma.Decimal;
  debtPerson?: string | null;
}): messagingApi.FlexContainer {
  const { type, amount, note, category, accountName, newBalance, debtPerson } = params;
  const color = TYPE_COLOR[type];
  const sign = SIGN[type];
  const amountStr = `${sign}฿${amount.toLocaleString("th-TH")}`;

  const detailRows: messagingApi.FlexComponent[] = [
    row("บัญชี", accountName),
    row("หมวด", category),
    ...(debtPerson ? [row("บุคคล", debtPerson)] : []),
    {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "คงเหลือ", size: "sm", color: "#8E8E93", flex: 2 },
        { type: "text", text: formatBalance(newBalance), size: "sm", weight: "bold", color: "#7EA184", align: "end", flex: 3 },
      ],
    },
  ];

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
            { type: "text", text: note || category, weight: "bold", size: "md", color: "#2C2C2E", flex: 1 },
            {
              type: "box",
              layout: "vertical",
              paddingAll: "3px",
              paddingStart: "10px",
              paddingEnd: "10px",
              backgroundColor: color.bg,
              cornerRadius: "20px",
              contents: [
                { type: "text", text: TYPE_LABEL[type], size: "xxs", weight: "bold", color: color.text },
              ],
            },
          ],
        },
        { type: "text", text: amountStr, size: "xxl", weight: "bold", color: color.text, margin: "md" },
        { type: "separator", margin: "md", color: "#E5E5EA" },
        { type: "box", layout: "vertical", margin: "md", spacing: "xs", contents: detailRows },
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

function row(label: string, value: string): messagingApi.FlexBox {
  return {
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: label, size: "sm", color: "#8E8E93", flex: 2 },
      { type: "text", text: value,  size: "sm", weight: "bold", align: "end", flex: 3 },
    ],
  };
}
