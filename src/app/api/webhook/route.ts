import { NextRequest, NextResponse } from "next/server";
import { verifyLineSignature, replyText, replyFlex } from "@/lib/line";
import type { LineWebhookBody, LineMessageEvent, LineTextMessage } from "@/lib/line";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { detectIntent, parseRecord } from "@/services/ai/parser";
import { recordTransaction } from "@/services/transactions/record";
import { recordDebt } from "@/services/transactions/debt";
import { buildReceiptFlex } from "@/flex-messages/receipt";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-line-signature") ?? "";
  const rawBody = await req.text();

  if (!verifyLineSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: LineWebhookBody = JSON.parse(rawBody);

  const events = (body.events ?? []).filter(
    (e): e is LineMessageEvent =>
      e.type === "message" && e.message.type === "text"
  );

  for (const event of events) {
    processEvent(event).catch(console.error);
  }

  return NextResponse.json({ ok: true });
}

async function processEvent(event: LineMessageEvent) {
  const message = event.message as LineTextMessage;
  const replyToken = event.replyToken;
  const lineUserId = event.source?.userId;
  if (!lineUserId || !replyToken) return;

  const text = message.text.trim();

  await prisma.user.upsert({
    where: { lineUserId },
    update: {},
    create: {
      lineUserId,
      settings: { create: {} },
      accounts: {
        create: { name: "กระเป๋าหลัก", type: "WALLET", isDefault: true },
      },
    },
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { lineUserId } });
  const intent = detectIntent(text);

  if (intent === "RECORD") {
    await handleRecord(replyToken, user.id, text);
    return;
  }

  await replyText(
    replyToken,
    "ขอโทษนะคะ Cooper อ่านรายการนี้ไม่ค่อยชัดเจน\nลองพิมพ์ใหม่ได้เลยค่ะ เช่น 'กาแฟ 65 กสิกร' หรือ 'บอยยืมค่าข้าว 150' 🐾"
  );
}

async function handleRecord(replyToken: string, userId: string, text: string) {
  const parsed = await parseRecord(text);

  if (!parsed) {
    await replyText(
      replyToken,
      "ขอโทษนะคะ Cooper ไม่แน่ใจว่าจะบันทึกอะไร\nลองพิมพ์ใหม่ชัดๆ ได้เลยนะคะ เช่น 'ชาบู 499 กสิกร' 🐾"
    );
    return;
  }

  const isDebt = parsed.type === "DEBT_LEND" || parsed.type === "DEBT_REPAY";
  const result = isDebt
    ? await recordDebt(userId, parsed)
    : await recordTransaction(userId, parsed);

  if (!result) {
    await replyText(replyToken, "เกิดข้อผิดพลาดในการบันทึกค่ะ กรุณาลองใหม่อีกครั้งนะคะ 🐾");
    return;
  }

  const newBalance = "newBalance" in result ? result.newBalance : new Prisma.Decimal(0);
  const accountName = "accountName" in result ? result.accountName : "กระเป๋าหลัก";

  const flexContents = buildReceiptFlex({
    type: parsed.type,
    amount: parsed.amount,
    note: parsed.note,
    category: parsed.category,
    accountName,
    newBalance,
    debtPerson: parsed.debt_person,
  });

  await replyFlex(
    replyToken,
    `บันทึก ${parsed.note || parsed.category} แล้วค่ะ`,
    flexContents
  );
}
