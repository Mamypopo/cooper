import { NextRequest, NextResponse } from "next/server";
import { verifyLineSignature, replyText, replyFlex } from "@/lib/line";
import type { LineWebhookBody, LineMessageEvent, LineTextMessage } from "@/lib/line";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { detectIntent, parseRecord, parseTransferCommand, parseBudgetSetCommand, parseCancelTxCommand, parseCloseDebtCommand } from "@/services/ai/parser";
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
import { buildTransferReceiptFlex } from "@/flex-messages/transfer-receipt";
import { transferBetweenAccounts } from "@/services/transactions/transfer";
import { cancelLatestTransaction } from "@/services/transactions/cancel";
import { closeDebt } from "@/services/debts/close";
import { cancelSubscription, parseCancelSubCommand } from "@/services/subscriptions/manage";

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
    await processEvent(event).catch(console.error);
  }

  return NextResponse.json({ ok: true });
}

const HELP_MESSAGE = `🐾 Cooper ช่วยได้แบบนี้งับ

💰 บันทึกรายการ
• "กาแฟ 65 กสิกร" → รายจ่าย
• "รับเงินเดือน 25000" → รายรับ
• "โอน 5000 กสิกร ไป ออมทรัพย์" → โอน

🤝 หนี้สิน
• "บอยยืมค่าข้าว 150" → บันทึกให้ยืม
• "บอยคืน 150" → บันทึกรับคืน
• "ปิดหนี้บอย" → ปิดหนี้ครบ

📋 ดูข้อมูล
• "ดูบัญชี" → ยอดทุกกระเป๋า
• "ดูประวัติ" → รายการล่าสุด
• "ดูหนี้" → สรุปหนี้สิน
• "ดูบิล" → รอบบิลประจำ

⚙️ ตั้งค่า
• "เพิ่มบัญชี กสิกร 12000" → สร้างกระเป๋า
• "บิล Netflix 299 วันที่ 15" → เพิ่มบิล
• "ยกเลิกบิล Netflix" → ลบบิล
• "ตั้งงบ 15000" → งบรายเดือน
• "ลบรายการล่าสุด" → ยกเลิกรายการล่าสุด

🧐 ถามงบ
• "ซื้อ AirPods ได้ไหม" → Cooper วิเคราะห์ให้`;

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

  // ยกเลิก/ลบรายการล่าสุด
  if (parseCancelTxCommand(text)) {
    await handleCancelTx(replyToken, user.id);
    return;
  }

  // ปิดหนี้ด้วยตัวเอง
  const closeDebtName = parseCloseDebtCommand(text);
  if (closeDebtName) {
    await handleCloseDebt(replyToken, user.id, closeDebtName);
    return;
  }

  // ยกเลิก subscription
  const cancelSubName = parseCancelSubCommand(text);
  if (cancelSubName) {
    await handleCancelSub(replyToken, user.id, cancelSubName);
    return;
  }

  // Transfer command (regex — ไม่เรียก Claude)
  const transferCmd = parseTransferCommand(text);
  if (transferCmd) {
    await handleTransfer(replyToken, user.id, transferCmd.amount, transferCmd.from, transferCmd.to);
    return;
  }

  // Budget setting command (regex — ไม่เรียก Claude)
  const budgetAmt = parseBudgetSetCommand(text);
  if (budgetAmt !== null) {
    await handleSetBudget(replyToken, user.id, budgetAmt);
    return;
  }

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
    case "UNKNOWN":
    default:
      if (/ช่วยเหลือ|help|คำสั่ง|ทำอะไรได้/i.test(text)) {
        await replyText(replyToken, HELP_MESSAGE);
      } else if (/dashboard|แดชบอร์ด|เปิด dashboard|ดู dashboard/i.test(text)) {
        await replyText(replyToken, `เปิด Dashboard ได้เลยงับ 🐾\n\nhttps://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_APP_ID}`);
      } else {
        await replyText(replyToken, `สวัสดีงับ 🐾 ไม่แน่ใจว่าหมายถึงอะไร\nพิมพ์ "ช่วยเหลือ" เพื่อดูคำสั่งทั้งหมดได้เลยนะงับ`);
      }
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

async function handleCancelTx(replyToken: string, userId: string) {
  const result = await cancelLatestTransaction(userId);
  if (!result) {
    await replyText(replyToken, "เกิดข้อผิดพลาดงับ ลองใหม่อีกครั้งนะงับ 🐾");
    return;
  }
  if ("type" in result && result.type === "NO_TRANSACTION") {
    await replyText(replyToken, "ยังไม่มีรายการให้ลบงับ 🐾");
    return;
  }
  if ("type" in result && result.type === "UNSUPPORTED_TYPE") {
    await replyText(replyToken, "รายการล่าสุดเป็น TRANSFER หรือหนี้งับ ยกเลิกอัตโนมัติไม่ได้\nติดต่อผู้ดูแลระบบเพื่อแก้ไขงับ 🐾");
    return;
  }
  if ("accountName" in result) {
    await replyText(
      replyToken,
      `✅ ลบรายการ "${result.note}" ฿${result.amount.toLocaleString("th-TH")} แล้วงับ 🐾\nคงเหลือใน ${result.accountName}: ฿${Number(result.newBalance).toLocaleString("th-TH")}`
    );
  }
}

async function handleCloseDebt(replyToken: string, userId: string, personName: string) {
  const result = await closeDebt(userId, personName);
  if (!result) {
    await replyText(replyToken, "เกิดข้อผิดพลาดงับ ลองใหม่อีกครั้งนะงับ 🐾");
    return;
  }
  if ("type" in result && result.type === "DEBT_NOT_FOUND") {
    await replyText(replyToken, `ไม่เจอหนี้ค้างของ "${result.personName}" งับ 🐾\nลองพิมพ์ชื่อใหม่ดูนะงับ`);
    return;
  }
  if ("amount" in result) {
    const msg = result.direction === "WE_LENT"
      ? `✅ ${result.personName} คืนครบแล้วงับ 🐾\nรับ ฿${result.amount.toLocaleString("th-TH")} เข้า ${result.accountName}\nคงเหลือ: ฿${Number(result.newBalance).toLocaleString("th-TH")}`
      : `✅ คืนเงิน ${result.personName} ครบแล้วงับ 🐾\nจ่าย ฿${result.amount.toLocaleString("th-TH")} จาก ${result.accountName}\nคงเหลือ: ฿${Number(result.newBalance).toLocaleString("th-TH")}`;
    await replyText(replyToken, msg);
  }
}

async function handleCancelSub(replyToken: string, userId: string, name: string) {
  const result = await cancelSubscription(userId, name);
  if (!result) {
    await replyText(replyToken, "เกิดข้อผิดพลาดงับ ลองใหม่อีกครั้งนะงับ 🐾");
    return;
  }
  if ("type" in result && result.type === "SUB_NOT_FOUND") {
    await replyText(replyToken, `ไม่เจอบิล "${result.requestedName}" งับ 🐾\nลองพิมพ์ชื่อใหม่ดูนะงับ`);
    return;
  }
  if ("name" in result) {
    await replyText(replyToken, `✅ ยกเลิกบิล "${result.name}" แล้วงับ 🐾\nจะไม่แจ้งเตือนอีกต่อไปนะงับ`);
  }
}

async function handleTransfer(replyToken: string, userId: string, amount: number, from: string, to: string) {
  const result = await transferBetweenAccounts(userId, amount, from, to);
  if (!result) {
    await replyText(replyToken, "เกิดข้อผิดพลาดในการโอนงับ ลองใหม่อีกครั้งนะงับ 🐾");
    return;
  }
  if ("type" in result && result.type === "ACCOUNT_NOT_FOUND") {
    await replyText(
      replyToken,
      `ไม่เจอบัญชี "${result.requestedName}" งับ 🐾\n\nสร้างก่อนได้เลยนะงับ:\n"เพิ่มบัญชี ${result.requestedName} [ยอดเงิน]"`
    );
    return;
  }
  if ("fromAccount" in result) {
    const flex = buildTransferReceiptFlex(result);
    await replyFlex(replyToken, `โอน ฿${amount.toLocaleString("th-TH")} จาก ${result.fromAccount.name} ไป ${result.toAccount.name} แล้วงับ`, flex);
  }
}

async function handleSetBudget(replyToken: string, userId: string, amount: number) {
  try {
    await prisma.userSettings.upsert({
      where: { userId },
      update: { monthlyBudget: amount },
      create: { userId, monthlyBudget: amount },
    });
    await replyText(
      replyToken,
      `✅ ตั้งงบรายเดือนไว้ที่ ฿${amount.toLocaleString("th-TH")} แล้วงับ 🐾\n\nCooper จะช่วยดูแลให้ไม่เกินงบนะงับ`
    );
  } catch {
    await replyText(replyToken, "เกิดข้อผิดพลาดในการตั้งงบงับ ลองใหม่อีกครั้งนะงับ 🐾");
  }
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

  const isDebt = parsed.type === "DEBT_LEND" || parsed.type === "DEBT_BORROW" || parsed.type === "DEBT_REPAY";
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
