import { callClaude } from "@/lib/claude";
import type { ParsedRecord } from "@/types/ai";

const RECORD_KEYWORDS = /\d+|ยืม|คืน|รับ|จ่าย|ซื้อ|ขาย|โอน|income|expense/i;
const BUDGET_KEYWORDS = /ซื้อได้ไหม|งบพอไหม|อยากได้|กิเลส|ควรซื้อ|พอไหม/i;
const ACCOUNT_QUERY  = /ดูบัญชี|บัญชีฉัน|กระเป๋าเงิน|ยอดเงิน/i;
const HISTORY_QUERY  = /ดูประวัติ|ประวัติ|รายการ|transaction/i;
const DEBT_QUERY     = /ดูหนี้|หนี้|ใครค้าง|สรุปหนี้/i;
const SUB_QUERY      = /ดูบิล|รอบบิล|subscription ทั้งหมด/i;

export type Intent = "RECORD" | "BUDGET_CHECK" | "QUERY_ACCOUNTS" | "QUERY_HISTORY" | "QUERY_DEBTS" | "QUERY_SUBS" | "UNKNOWN";

export function detectIntent(text: string): Intent {
  if (BUDGET_KEYWORDS.test(text)) return "BUDGET_CHECK";
  if (ACCOUNT_QUERY.test(text))   return "QUERY_ACCOUNTS";
  if (HISTORY_QUERY.test(text))   return "QUERY_HISTORY";
  if (DEBT_QUERY.test(text))      return "QUERY_DEBTS";
  if (SUB_QUERY.test(text))       return "QUERY_SUBS";
  if (RECORD_KEYWORDS.test(text)) return "RECORD";
  return "UNKNOWN";
}

function extractJSON(raw: string): string {
  const match = raw.match(/\{[\s\S]*\}/);
  return match ? match[0] : "";
}

function isValidRecord(obj: unknown): obj is ParsedRecord {
  if (typeof obj !== "object" || obj === null) return false;
  const r = obj as Record<string, unknown>;
  return (
    r.action === "RECORD" &&
    typeof r.amount === "number" &&
    r.amount > 0 &&
    typeof r.account_name === "string" &&
    typeof r.category === "string" &&
    ["INCOME", "EXPENSE", "TRANSFER", "DEBT_LEND", "DEBT_REPAY"].includes(
      r.type as string
    )
  );
}

export async function parseRecord(
  text: string,
  attempt = 1
): Promise<ParsedRecord | null> {
  try {
    const raw = await callClaude(text);
    console.log("[parser] raw Claude response:", raw);
    const json = extractJSON(raw);
    console.log("[parser] extracted JSON:", json);
    const parsed = JSON.parse(json);
    if (isValidRecord(parsed)) return parsed;
    console.log("[parser] schema mismatch:", parsed);
    throw new Error("schema mismatch");
  } catch (err) {
    console.error(`[parser] attempt ${attempt} failed:`, err);
    if (attempt < 2) return parseRecord(text, attempt + 1);
    return null;
  }
}
