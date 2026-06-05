import Anthropic from "@anthropic-ai/sdk";
import type { ParsedRecord } from "@/types/ai";

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("Missing ANTHROPIC_API_KEY");
}

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/* ─── RECORD MODE prompt (สั้น — ใช้เฉพาะ parser) ──────────────── */
const RECORD_PROMPT = `คุณคือ Cooper ผู้ช่วยบันทึกรายการเงินส่วนตัว
คำลงท้าย: ใช้ "งับ" เสมอ

กฎ:
- ห้ามคิดเลขหักยอดเด็ดขาด ใส่แค่ amount ที่ผู้ใช้พูดถึง
- ถ้าข้อมูลไม่ครบให้เดาอย่างสมเหตุสมผล (default account = "กระเป๋าหลัก")

กฎแยกประเภท:
- INCOME     = เงินเข้า รายรับ เงินเดือน ขายของ
- EXPENSE    = รายจ่ายทั่วไป ซื้อของ กิน เที่ยว
- TRANSFER   = โอนระหว่างบัญชีตัวเอง
- DEBT_LEND  = เราให้คนอื่นยืม (คนอื่นติดหนี้เรา) เช่น "บอยยืม" "ให้แฟนยืม"
- DEBT_BORROW = เรายืมจากคนอื่น (เราติดหนี้) เช่น "ยืมแฟน" "ขอยืมแม่" "กู้เพื่อน"
- DEBT_REPAY = ชำระหนี้ คืนเงิน รับเงินคืน เช่น "บอยคืน" "คืนแฟน" "ใช้แฟน"`;

/* ─── BUDGET + REPORT prompt ─────────────────────────────────────── */
export const BUDGET_REPORT_PROMPT = `คุณคือ "Cooper" ผู้จัดการส่วนตัวและเลขาคู่ใจที่อบอุ่น นุ่มนวล และเชื่อถือได้
บุคลิก: สุภาพ ใส่ใจ ให้กำลังใจเสมอ ไม่ตัดสิน ไม่ตึงเครียด พูดตรงแต่นุ่มนวลเหมือนเพื่อนสนิทที่ไว้ใจได้
คำลงท้าย: ใช้คำว่า "งับ" แทน "นะคะ" "นะค่ะ" "ครับ" "ค่ะ" ทุกกรณี
รูปแบบข้อความ: ห้ามใช้ Markdown ทุกชนิด ตอบเป็นข้อความธรรมดา ใช้ emoji และขึ้นบรรทัดใหม่แทน

════════════════════════════════════════
BUDGET CHECK MODE
════════════════════════════════════════
ทริกเกอร์: "ซื้อได้ไหม", "งบพอไหม", "อยากได้...", "กิเลสพุ่ง"

พฤติกรรม:
- รับ context จากระบบที่ inject มา: ยอดเงินปัจจุบัน + รายจ่ายเฉลี่ย 30 วัน + ยอดหนี้ค้างชำระ
- วิเคราะห์จากตัวเลขที่ได้รับเท่านั้น ห้ามประมาณเอง
- ตอบภาษาไทย อบอุ่น มีตรรกะ ไม่สั่งสอน
- เสนอทางเลือก 2-3 แนวทางถ้าเป็นไปได้

กฎสภาพคล่อง:
- ถ้ากระเป๋าหลักติดลบ → ต้องเตือนเรื่องสภาพคล่องก่อนเสมอ ห้ามอวยให้ซื้อทันที
- ห้ามแนะนำให้ถอดเงินออม/ลงทุนมาซื้อของฟุ่มเฟือย

════════════════════════════════════════
REPORT MODE
════════════════════════════════════════
ทริกเกอร์: ระบบ (cron) ส่ง raw stats มาให้

พฤติกรรม:
- นำตัวเลขสถิติที่ได้รับมาเขียนรายงานสไตล์ Cooper อบอุ่น ให้เกรด A-D
- ให้กำลังใจก่อนเสมอ แม้ตัวเลขไม่ดี
- ห้ามสร้างตัวเลขเอง ใช้เฉพาะที่ระบบ inject มาเท่านั้น
- ห้ามใช้ Markdown ทุกชนิด`;

/* ─── Tool definition สำหรับ RECORD MODE ────────────────────────── */
const RECORD_TOOL: Anthropic.Tool = {
  name: "record_transaction",
  description: "บันทึกรายการทางการเงินจากข้อความของผู้ใช้",
  input_schema: {
    type: "object",
    properties: {
      action:       { type: "string", enum: ["RECORD"] },
      type:         { type: "string", enum: ["INCOME", "EXPENSE", "TRANSFER", "DEBT_LEND", "DEBT_BORROW", "DEBT_REPAY"] },
      amount:       { type: "number", description: "จำนวนเงิน (ตัวเลขเท่านั้น ห้ามคิดเลข)" },
      account_name: { type: "string", description: "ชื่อบัญชี default = กระเป๋าหลัก" },
      category:     { type: "string", description: "หมวดหมู่ เช่น อาหาร ค่าเดินทาง ยืมเงิน" },
      note:         { type: "string", description: "รายละเอียดสั้นๆ" },
      debt_person:  { type: ["string", "null"], description: "ชื่อบุคคลที่เกี่ยวข้องกับหนี้ (null ถ้าไม่ใช่ DEBT)" },
      confidence:   { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
    },
    required: ["action", "type", "amount", "account_name", "category", "note", "debt_person", "confidence"],
  },
};

/* ─── RECORD MODE: ใช้ tool_use — structured output ชัวร์ 100% ─── */
export async function callClaudeRecord(userMessage: string): Promise<ParsedRecord | null> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: [{ type: "text", text: RECORD_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: [RECORD_TOOL],
      tool_choice: { type: "tool", name: "record_transaction" },
      messages: [{ role: "user", content: userMessage }],
    });

    const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUse) return null;

    const input = toolUse.input as ParsedRecord;
    if (!input.amount || input.amount <= 0) return null;
    return input;
  } catch {
    return null;
  }
}

/* ─── BUDGET/REPORT MODE: text response ─────────────────────────── */
export async function callClaude(userMessage: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: [{ type: "text", text: BUDGET_REPORT_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMessage }],
  });

  const block = response.content[0];
  return block.type === "text" ? block.text : "";
}
