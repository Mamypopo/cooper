import "dotenv/config";

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!;
const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_APP_ID!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

if (!TOKEN || !LIFF_ID || !APP_URL) {
  console.error("❌ ขาด env: LINE_CHANNEL_ACCESS_TOKEN, NEXT_PUBLIC_LIFF_APP_ID, NEXT_PUBLIC_APP_URL");
  process.exit(1);
}

async function lineBot(path: string, method: string, body?: unknown) {
  const res = await fetch(`https://api.line.me/v2/bot${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`LINE API ${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function main() {
  // 1. ลบ rich menu เดิมทั้งหมด (clean slate)
  console.log("🧹 ลบ Rich Menu เดิม...");
  const { richmenus } = await lineBot("/richmenu/list", "GET");
  for (const m of richmenus ?? []) {
    await lineBot(`/richmenu/${m.richMenuId}`, "DELETE");
    console.log(`   ลบ ${m.richMenuId}`);
  }

  // 2. สร้าง Rich Menu ใหม่
  console.log("📐 สร้าง Rich Menu...");
  const { richMenuId } = await lineBot("/richmenu", "POST", {
    size: { width: 1200, height: 810 },
    selected: true,
    name: "Cooper Menu",
    chatBarText: "เมนู Cooper 🐾",
    areas: [
      // Row 1
      { bounds: { x: 0,   y: 0,   width: 400, height: 405 }, action: { type: "message", text: "ดูบัญชี" } },
      { bounds: { x: 400, y: 0,   width: 400, height: 405 }, action: { type: "message", text: "ดูประวัติ" } },
      { bounds: { x: 800, y: 0,   width: 400, height: 405 }, action: { type: "message", text: "ดูหนี้" } },
      // Row 2
      { bounds: { x: 0,   y: 405, width: 400, height: 405 }, action: { type: "uri", uri: `https://liff.line.me/${LIFF_ID}` } },
      { bounds: { x: 400, y: 405, width: 400, height: 405 }, action: { type: "message", text: "ดูบิล" } },
      { bounds: { x: 800, y: 405, width: 400, height: 405 }, action: { type: "message", text: "ช่วยเหลือ" } },
    ],
  });
  console.log(`   Rich Menu ID: ${richMenuId}`);

  // 3. ดึง + อัปโหลดรูปจาก Next.js endpoint
  console.log("🖼️  ดึงรูปจาก", `${APP_URL}/api/rich-menu-image`);
  const imgRes = await fetch(`${APP_URL}/api/rich-menu-image`);
  if (!imgRes.ok) throw new Error(`ดึงรูปไม่ได้: ${imgRes.status}`);
  const imgBuffer = await imgRes.arrayBuffer();

  const uploadRes = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "image/png",
    },
    body: imgBuffer,
  });
  if (!uploadRes.ok) throw new Error(`อัปโหลดรูปไม่ได้: ${uploadRes.status}`);
  console.log("   อัปโหลดรูปสำเร็จ");

  // 4. ตั้งเป็น default สำหรับ user ทุกคน
  await lineBot(`/user/all/richmenu/${richMenuId}`, "POST");
  console.log("✅ ตั้ง Rich Menu เป็น default แล้ว!");
  console.log(`\n📋 Rich Menu ID: ${richMenuId}`);
  console.log(`🔗 Preview รูป: ${APP_URL}/api/rich-menu-image`);
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
