import { NextRequest, NextResponse } from "next/server";
import { verifyLineSignature, replyText, replyFlex } from "@/lib/line";
import type { LineWebhookBody, LineMessageEvent, LineTextMessage } from "@/lib/line";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { detectIntent, parseRecord } from "@/services/ai/parser";
import { recordTransaction } from "@/services/transactions/record";
import { recordDebt } from "@/services/transactions/debt";
import { setupAccount, parseSetupCommand } from "@/services/accounts/setup";
import { getAccountSummary } from "@/services/queries/accounts";
import { getRecentTransactions } from "@/services/queries/transactions";
import { getDebtSummary } from "@/services/queries/debts";
import { runBudgetCheck } from "@/services/ai/budget-check";
import { parseSubscriptionCommand, upsertSubscription, getSubscriptions } from "@/services/subscriptions/manage";
import { buildSubscriptionConfirmFlex } from "@/flex-messages/subscription-confirm";
import { buildSubscriptionListFlex } from "@/flex-messages/subscription-list";
import { buildReceiptFlex } from "@/flex-messages/receipt";
import { buildAccountConfirmFlex } from "@/flex-messages/account-confirm";
import { buildAccountSummaryFlex } from "@/flex-messages/account-summary";
import { buildHistoryFlex } from "@/flex-messages/history";
import { buildDebtSummaryFlex } from "@/flex-messages/debt-summary";

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

  // Subscription command (regex — ไม่เรียก Claude)
  const subCmd = parseSubscriptionCommand(text);
  if (subCmd) {
    await handleUpsertSubscription(replyToken, user.id, subCmd.name, subCmd.amount, subCmd.billingDay);
    return;
  }

  // Setup account command (regex — ไม่เรียก Claude)
  const setupCmd = parseSetupCommand(text);
  if (setupCmd) {
    await handleSetupAccount(replyToken, user.id, setupCmd.name, setupCmd.balance);
    return;
  }

  const intent = detectIntent(text);

  switch (intent) {
    case "RECORD":
      await handleRecord(replyToken, user.id, text);
      break;
    case "QUERY_ACCOUNTS":
      await handleQueryAccounts(replyToken, user.id);
      break;
    case "QUERY_HISTORY":
      await handleQueryHistory(replyToken, user.id);
      break;
    case "QUERY_DEBTS":
      await handleQueryDebts(replyToken, user.id);
      break;
    case "BUDGET_CHECK":
      await handleBudgetCheck(replyToken, user.id, text);
      break;
    case "QUERY_SUBS":
      await handleQuerySubs(replyToken, user.id);
      break;
    default:
      await replyText(
        replyToken,
        "สวัสดีงับ 🐾 Cooper พร้อมช่วยเสมองับ\n\nพิมพ์ได้เลยงับ เช่น\n• 'กาแฟ 65 กสิกร' → บันทึกรายจ่าย\n• 'เพิ่มบัญชี กสิกร 12000' → ตั้งค่ากระเป๋าเงิน\n• 'บอยยืมค่าข้าว 150' → บันทึกการยืม\n• 'ดูบัญชี' → ดูยอดทุกกระเป๋า\n• 'ดูประวัติ' → รายการล่าสุด\n• 'ดูหนี้' → สรุปหนี้สิน"
      );
  }
}

async function handleSetupAccount(replyToken: string, userId: string, name: string, balance: number) {
  const result = await setupAccount(userId, name, balance);
  if (!result) {
    await replyText(replyToken, "เกิดข้อผิดพลาดในการบันทึกบัญชีงับ ลองใหม่อีกครั้งงับ 🐾");
    return;
  }
  const flex = buildAccountConfirmFlex(result);
  await replyFlex(replyToken, `${result.isNew ? "เพิ่ม" : "อัปเดต"}บัญชี ${result.name} แล้วงับ`, flex);
}

async function handleQueryAccounts(replyToken: string, userId: string) {
  const data = await getAccountSummary(userId);
  const flex = buildAccountSummaryFlex(data);
  await replyFlex(replyToken, "สรุปยอดทุกกระเป๋างับ", flex);
}

async function handleQueryHistory(replyToken: string, userId: string) {
  const txs = await getRecentTransactions(userId);
  const flex = buildHistoryFlex(txs);
  await replyFlex(replyToken, "รายการล่าสุดงับ", flex);
}

async function handleQueryDebts(replyToken: string, userId: string) {
  const data = await getDebtSummary(userId);
  const flex = buildDebtSummaryFlex(data);
  await replyFlex(replyToken, "สรุปหนี้สินงับ", flex);
}

async function handleUpsertSubscription(
  replyToken: string, userId: string, name: string, amount: number, billingDay: number
) {
  const result = await upsertSubscription(userId, name, amount, billingDay);
  if (!result) {
    await replyText(replyToken, "เกิดข้อผิดพลาดในการบันทึกบิลงับ ลองใหม่อีกครั้งนะงับ 🐾");
    return;
  }
  const flex = buildSubscriptionConfirmFlex(result);
  await replyFlex(replyToken, `${result.isNew ? "เพิ่ม" : "อัปเดต"}บิล ${result.name} แล้วงับ`, flex);
}

async function handleQuerySubs(replyToken: string, userId: string) {
  const subs = await getSubscriptions(userId);
  const flex = buildSubscriptionListFlex(subs);
  await replyFlex(replyToken, "รอบบิลประจำทั้งหมดงับ", flex);
}

async function handleBudgetCheck(replyToken: string, userId: string, text: string) {
  const reply = await runBudgetCheck(userId, text);
  await replyText(replyToken, reply);
}

async function handleRecord(replyToken: string, userId: string, text: string) {
  const parsed = await parseRecord(text);
  if (!parsed) {
    await replyText(replyToken, "ขอโทษงับ Cooper ไม่แน่ใจว่าจะบันทึกอะไร\nลองพิมพ์ใหม่ชัดๆ ได้เลยงับ เช่น 'ชาบู 499 กสิกร' 🐾");
    return;
  }

  const isDebt = parsed.type === "DEBT_LEND" || parsed.type === "DEBT_REPAY";
  const result = isDebt
    ? await recordDebt(userId, parsed)
    : await recordTransaction(userId, parsed);

  if (!result) {
    await replyText(replyToken, "เกิดข้อผิดพลาดในการบันทึกงับ กรุณาลองใหม่อีกครั้งงับ 🐾");
    return;
  }

  if ("type" in result && result.type === "ACCOUNT_NOT_FOUND") {
    await replyText(
      replyToken,
      `ไม่เจอบัญชี "${result.requestedName}" งับ 🐾\n\nสร้างก่อนได้เลยนะงับ:\n"เพิ่มบัญชี ${result.requestedName} [ยอดเงิน]"\n\nหรือถ้าพิมพ์ชื่อผิดก็ลองใหม่ได้เลยงับ`
    );
    return;
  }

  const newBalance = "newBalance" in result ? result.newBalance : new Prisma.Decimal(0);
  const accountName = "accountName" in result ? result.accountName : "กระเป๋าหลัก";

  const flex = buildReceiptFlex({
    type: parsed.type,
    amount: parsed.amount,
    note: parsed.note,
    category: parsed.category,
    accountName,
    newBalance,
    debtPerson: parsed.debt_person,
  });

  await replyFlex(replyToken, `บันทึก ${parsed.note || parsed.category} แล้วงับ`, flex);
}
