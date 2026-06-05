import { NextRequest } from "next/server";
import { generatePromptPayPayload } from "@/lib/promptpay";
import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const amount = Number(req.nextUrl.searchParams.get("amount") ?? 0);
  const phone = process.env.NEXT_PUBLIC_PROMPTPAY_NUMBER ?? "";
  const payload = generatePromptPayPayload(phone, amount);

  // Encode payload เป็น URL สำหรับ QR service
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payload)}`;

  const res = await fetch(qrApiUrl);
  const imgBuffer = await res.arrayBuffer();

  return new Response(imgBuffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=300",
    },
  });
}
