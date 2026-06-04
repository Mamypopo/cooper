import { callClaude } from "@/lib/claude";
import type { ParsedRecord } from "@/types/ai";

const RECORD_KEYWORDS = /\d+|ยืม|คืน|รับ|จ่าย|ซื้อ|ขาย|โอน|income|expense/i;
const BUDGET_KEYWORDS = /ซื้อได้ไหม|งบพอไหม|อยากได้|กิเลส|ควรซื้อ|พอไหม/i;

export type Intent = "RECORD" | "BUDGET_CHECK" | "UNKNOWN";

export function detectIntent(text: string): Intent {
  if (BUDGET_KEYWORDS.test(text)) return "BUDGET_CHECK";
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
    const json = extractJSON(raw);
    const parsed = JSON.parse(json);
    if (isValidRecord(parsed)) return parsed;
    throw new Error("schema mismatch");
  } catch {
    if (attempt < 2) return parseRecord(text, attempt + 1);
    return null;
  }
}
