import { NextRequest, NextResponse } from "next/server";
import { verifyLineSignature, replyText, replyFlex, pushText, lineClient } from "@/lib/line";
import type { LineWebhookBody, LineMessageEvent, LineTextMessage } from "@/lib/line";
import { webhook } from "@line/bot-sdk";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { detectIntent, parseRecord, parseTransferCommand, parseBudgetSetCommand, parseCancelTxCommand, parseCloseDebtCommand } from "@/services/ai/parser";
import { recordTransaction } from "@/services/transactions/record";
import { recordDebt } from "@/services/transactions/debt";
import { setupAccount, parseSetupCommand, renameAccount, parseRenameAccountCommand } from "@/services/accounts/setup";
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
import { isRecordRateLimited } from "@/lib/rate-limit";
import { checkAccess, activateSubscriber, suspendUser, listSubscribers } from "@/services/access/check";
import { closeDebt } from "@/services/debts/close";
import { cancelSubscription, parseCancelSubCommand } from "@/services/subscriptions/manage";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-line-signature") ?? "";
  const rawBody = await req.text();

  if (!verifyLineSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: LineWebhookBody = JSON.parse(rawBody);

  for (const event of body.events ?? []) {
    if (event.type === "follow") {
      await processFollow(event as webhook.FollowEvent).catch(console.error);
    } else if (event.type === "message" && (event as LineMessageEvent).message.type === "text") {
      await processEvent(event as LineMessageEvent).catch(console.error);
    }
  }

  return NextResponse.json({ ok: true });
}

const SUBSCRIBE_URL = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_SUBSCRIBE_ID}`;

async function processFollow(event: webhook.FollowEvent) {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;

  const isAdmin = lineUserId === process.env.ADMIN_LINE_USER_ID;
  const profile = await lineClient.getProfile(lineUserId).catch(() => null);

  await prisma.user.upsert({
    where: { lineUserId },
    update: {
      ...(profile?.displayName && { displayName: profile.displayName }),
      ...(profile?.pictureUrl  && { pictureUrl:  profile.pictureUrl  }),
    },
    create: {
      lineUserId,
      role: isAdmin ? "ADMIN" : "PENDING",
      displayName: profile?.displayName ?? null,
      pictureUrl:  profile?.pictureUrl  ?? null,
      settings: { create: {} },
      accounts: {
        create: { name: "กระเป๋าหลัก", type: "WALLET", isDefault: true },
      },
    },
  });

  if (!isAdmin) {
    await lineClient.replyMessage({
      replyToken: (event as unknown as { replyToken: string }).replyToken,
      messages: [{ type: "text", text: `สวัสดีงับ 🐾 ผม Cooper ผู้จัดการการเงินส่วนตัวของคุณ\n\nCooper เป็นระบบสำหรับสมาชิกนะงับ สมัครได้เลยที่นี่:\n${SUBSCRIBE_URL}` }],
    }).catch(() => null);
  }
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

  const isAdmin = lineUserId === process.env.ADMIN_LINE_USER_ID;

  const profile = await lineClient.getProfile(lineUserId).catch(() => null);

  await prisma.user.upsert({
    where: { lineUserId },
    update: {
      ...(profile?.displayName && { displayName: profile.displayName }),
      ...(profile?.pictureUrl  && { pictureUrl:  profile.pictureUrl  }),
    },
    create: {
      lineUserId,
      role: isAdmin ? "ADMIN" : "PENDING",
      displayName: profile?.displayName ?? null,
      pictureUrl:  profile?.pictureUrl  ?? null,
      settings: { create: {} },
      accounts: {
        create: { name: "กระเป๋าหลัก", type: "WALLET", isDefault: true },
      },
    },
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { lineUserId } });

  // Admin upgrade ตัวเองเป็น ADMIN ถ้า role ยัง PENDING
  if (isAdmin && user.role === "PENDING") {
    await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  }

  // Admin commands
  if (isAdmin) {
    const activateMatch = text.match(/^ยืนยัน\s+(U\w+)(?:\s+(\d+))?/);
    if (activateMatch) {
      const days = activateMatch[2] ? parseInt(activateMatch[2]) : 30;
      const result = await activateSubscriber(activateMatch[1], days);
      if (!result) { await replyText(replyToken, "ไม่เจอ user งับ"); return; }
      const ends = result.subscriptionEnds.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
      await replyText(replyToken, `✅ เปิดสิทธิ์ ${result.displayName ?? activateMatch[1]} แล้วงับ\nหมดอายุ: ${ends}`);
      await pushText(activateMatch[1], `🎉 สมัครสมาชิก Cooper สำเร็จแล้วงับ!\nสิทธิ์ใช้งานถึง ${ends}\n\nเริ่มใช้ได้เลยนะงับ 🐾`);
      return;
    }
    const suspendMatch = text.match(/^ระงับ\s+(U\w+)/);
    if (suspendMatch) {
      const result = await suspendUser(suspendMatch[1]);
      if (!result) { await replyText(replyToken, "ไม่เจอ user งับ"); return; }
      await replyText(replyToken, `✅ ระงับสิทธิ์ ${result.displayName ?? suspendMatch[1]} แล้วงับ`);
      return;
    }
    // สร้างโค้ดส่วนลด: "สร้างโค้ด SUMMER50 50" หรือ "สร้างโค้ด FRIEND20 20 10" (จำกัด 10 uses)
    const createCodeMatch = text.match(/^สร้างโค้ด\s+(\S+)\s+(\d+)(?:\s+(\d+))?/);
    if (createCodeMatch) {
      const code = createCodeMatch[1].toUpperCase();
      const discount = Math.min(100, parseInt(createCodeMatch[2]));
      const usageLimit = createCodeMatch[3] ? parseInt(createCodeMatch[3]) : null;
      await prisma.discountCode.upsert({
        where: { code },
        update: { discount, usageLimit, isActive: true, usedCount: 0 },
        create: { code, discount, usageLimit },
      });
      const limitText = usageLimit ? ` จำกัด ${usageLimit} ครั้ง` : " ไม่จำกัดครั้ง";
      await replyText(replyToken, `✅ สร้างโค้ด ${code} ลด ${discount}%${limitText} แล้วงับ`);
      return;
    }

    // ลบโค้ด: "ลบโค้ด SUMMER50"
    const deleteCodeMatch = text.match(/^ลบโค้ด\s+(\S+)/);
    if (deleteCodeMatch) {
      const code = deleteCodeMatch[1].toUpperCase();
      await prisma.discountCode.updateMany({ where: { code }, data: { isActive: false } });
      await replyText(replyToken, `✅ ปิดโค้ด ${code} แล้วงับ`);
      return;
    }

    // ดูโค้ดทั้งหมด
    if (/^ดูโค้ด$|^รายการโค้ด$/.test(text.trim())) {
      const codes = await prisma.discountCode.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" } });
      if (!codes.length) { await replyText(replyToken, "ไม่มีโค้ดส่วนลดที่ใช้งานได้งับ"); return; }
      const lines = codes.map((c) => `• ${c.code} ลด ${c.discount}% (ใช้แล้ว ${c.usedCount}${c.usageLimit ? `/${c.usageLimit}` : ""})`);
      await replyText(replyToken, `โค้ดส่วนลดทั้งหมดงับ\n\n${lines.join("\n")}`);
      return;
    }

    if (/^สมาชิก$|^รายชื่อสมาชิก$/.test(text.trim())) {
      const subs = await listSubscribers();
      const lines = subs.map((s) => {
        const ends = s.subscriptionEnds
          ? s.subscriptionEnds.toLocaleDateString("th-TH", { day: "numeric", month: "short" })
          : "ไม่หมด";
        return `• ${s.displayName ?? s.lineUserId} [${s.role}] ถึง ${ends}`;
      });
      await replyText(replyToken, `สมาชิกทั้งหมด ${subs.length} คนงับ\n\n${lines.join("\n")}`);
      return;
    }
  }

  // Access check — non-admin
  if (!isAdmin) {
    const access = await checkAccess(user.id);
    if (access === "PENDING") {
      await replyText(replyToken, `สวัสดีงับ 🐾 Cooper เป็นระบบสำหรับสมาชิกเท่านั้นนะงับ\n\nสมัครสมาชิกได้ที่นี่เลยงับ:\n${SUBSCRIBE_URL}`);
      return;
    }
    if (access === "EXPIRED") {
      await replyText(replyToken, `สิทธิ์สมาชิกของคุณหมดอายุแล้วงับ 🐾\nต่ออายุได้ที่:\n${SUBSCRIBE_URL}`);
      return;
    }
  }

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

  // Rename account command
  const renameCmd = parseRenameAccountCommand(text);
  if (renameCmd) {
    await handleRenameAccount(replyToken, user.id, renameCmd.oldName, renameCmd.newName);
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
      await handleQueryHistory(replyToken, user.id, 7);
      break;
    case "QUERY_HISTORY_MORE":
      await handleQueryHistory(replyToken, user.id, 20);
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

async function handleRenameAccount(replyToken: string, userId: string, oldName: string, newName: string) {
  const result = await renameAccount(userId, oldName, newName);
  if (!result) {
    await replyText(replyToken, `ไม่เจอบัญชี "${oldName}" งับ 🐾\nลองพิมพ์ "ดูบัญชี" เพื่อเช็คชื่อที่ถูกต้องนะงับ`);
    return;
  }
  await replyText(replyToken, `✅ เปลี่ยนชื่อบัญชี "${result.oldName}" เป็น "${result.newName}" แล้วงับ 🐾`);
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

async function handleQueryHistory(replyToken: string, userId: string, limit = 7) {
  const txs = await getRecentTransactions(userId, limit);
  const hasMore = txs.length === limit && limit === 7;
  const flex = buildHistoryFlex(txs, hasMore);
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
  if (await isRecordRateLimited(userId)) {
    await replyText(replyToken, "กรุณารอสักครู่งับ 🐾 Cooper เพิ่งบันทึกรายการไปงับ");
    return;
  }
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
