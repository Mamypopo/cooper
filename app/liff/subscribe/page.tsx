"use client";

import { useEffect, useState } from "react";

const PRICE_MONTHLY = Number(process.env.NEXT_PUBLIC_PRICE_MONTHLY ?? 99);
const PRICE_YEARLY  = Number(process.env.NEXT_PUBLIC_PRICE_YEARLY  ?? 990);

const PLANS = [
  { key: "monthly", label: "รายเดือน", basePrice: PRICE_MONTHLY, days: 30,  badge: "" },
  { key: "yearly",  label: "รายปี",    basePrice: PRICE_YEARLY,  days: 365,
    badge: `ประหยัด ${Math.round((1 - PRICE_YEARLY / (PRICE_MONTHLY * 12)) * 100)}%` },
];

export default function SubscribePage() {
  const [lineUserId, setLineUserId]     = useState("");
  const [selectedPlan, setSelectedPlan] = useState<typeof PLANS[0] | null>(null);
  const [step, setStep]                 = useState<"plan" | "payment">("plan");
  const [copied, setCopied]             = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [discountPct, setDiscountPct]   = useState(0);
  const [codeStatus, setCodeStatus]     = useState<"idle" | "valid" | "invalid">("idle");
  const [checkingCode, setCheckingCode] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_SUBSCRIBE_ID! });
        if (!liff.isLoggedIn()) { liff.login(); return; }
        const profile = await liff.getProfile();
        setLineUserId(profile.userId);
      } catch {}
    }
    init();
  }, []);

  async function applyCode() {
    if (!discountCode.trim()) return;
    setCheckingCode(true);
    try {
      const res  = await fetch(`/api/liff/discount?code=${encodeURIComponent(discountCode.trim())}`);
      const data = await res.json();
      if (data.valid) { setDiscountPct(data.discount); setCodeStatus("valid"); }
      else            { setDiscountPct(0);              setCodeStatus("invalid"); }
    } catch {
      setCodeStatus("invalid");
    } finally {
      setCheckingCode(false);
    }
  }

  function finalPrice(base: number) { return Math.round(base * (1 - discountPct / 100)); }

  function selectPlan(plan: typeof PLANS[0]) { setSelectedPlan(plan); setStep("payment"); }

  function copyUserId() {
    navigator.clipboard.writeText(lineUserId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const card = "bg-white rounded-2xl border border-line";

  return (
    <div className="min-h-dvh bg-sheet px-5 py-5 max-w-[430px] mx-auto">

      {/* Header */}
      <div className="text-center mb-7">
        <div className="text-4xl mb-2">🐾</div>
        <div className="text-[22px] font-bold text-charcoal">Cooper สมาชิก</div>
        <div className="text-sm text-muted mt-1">ผู้จัดการการเงินส่วนตัว AI</div>
      </div>

      {step === "plan" && (
        <>
          {/* Features */}
          <div className={`${card} p-4 mb-5`}>
            {["บันทึกรายรับ-รายจ่ายด้วยภาษาพูด", "ติดตามหนี้สินและการยืม-คืน", "แจ้งเตือนบิลล่วงหน้า", "รายงานการเงินรายสัปดาห์", "Dashboard วิเคราะห์การเงิน"].map((f) => (
              <div key={f} className="flex items-center gap-2.5 py-2 border-b border-line last:border-0">
                <span className="text-income font-bold">✓</span>
                <span className="text-[13px] text-charcoal">{f}</span>
              </div>
            ))}
          </div>

          {/* Discount code */}
          <div className={`${card} p-3.5 mb-4`}>
            <div className="text-[13px] font-semibold text-charcoal mb-2">มีโค้ดส่วนลด?</div>
            <div className="flex gap-2">
              <input
                value={discountCode}
                onChange={e => { setDiscountCode(e.target.value.toUpperCase()); setCodeStatus("idle"); setDiscountPct(0); }}
                placeholder="ใส่โค้ดที่นี่"
                className={`flex-1 px-3 py-2 rounded-[10px] border text-[13px] outline-none tracking-wider ${
                  codeStatus === "valid"   ? "border-income" :
                  codeStatus === "invalid" ? "border-expense" : "border-line"
                }`}
              />
              <button onClick={applyCode} disabled={checkingCode || !discountCode.trim()}
                className="px-4 py-2 rounded-[10px] bg-charcoal text-white text-[13px] font-semibold disabled:opacity-40 cursor-pointer">
                {checkingCode ? "..." : "ใช้โค้ด"}
              </button>
            </div>
            {codeStatus === "valid"   && <p className="text-xs text-income mt-1.5">✓ โค้ดถูกต้อง! ลด {discountPct}%</p>}
            {codeStatus === "invalid" && <p className="text-xs text-expense mt-1.5">✗ โค้ดไม่ถูกต้องหรือหมดอายุแล้ว</p>}
          </div>

          {/* Plans */}
          {PLANS.map((plan) => {
            const price       = finalPrice(plan.basePrice);
            const hasDiscount = discountPct > 0;
            const isYearly    = plan.key === "yearly";
            return (
              <button key={plan.key} onClick={() => selectPlan(plan)}
                className={`relative w-full mb-3 p-4 rounded-2xl border text-left cursor-pointer ${
                  isYearly ? "bg-charcoal border-charcoal" : "bg-white border-line"
                }`}>
                {plan.badge && (
                  <span className="absolute -top-2.5 right-4 bg-income text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                    {plan.badge}
                  </span>
                )}
                <div className="flex justify-between items-center">
                  <div>
                    <div className={`text-base font-bold ${isYearly ? "text-white" : "text-charcoal"}`}>{plan.label}</div>
                    <div className={`text-xs mt-0.5 ${isYearly ? "text-white/60" : "text-muted"}`}>{plan.days} วัน</div>
                  </div>
                  <div className="text-right">
                    {hasDiscount && (
                      <div className={`text-xs line-through ${isYearly ? "text-white/50" : "text-muted"}`}>฿{plan.basePrice}</div>
                    )}
                    <div className={`text-2xl font-extrabold ${hasDiscount ? "text-income" : isYearly ? "text-white" : "text-charcoal"}`}>
                      ฿{price}
                    </div>
                    <div className={`text-[11px] ${isYearly ? "text-white/60" : "text-muted"}`}>
                      ฿{(price / plan.days * 30).toFixed(0)}/เดือน
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </>
      )}

      {step === "payment" && selectedPlan && (
        <>
          <button onClick={() => setStep("plan")}
            className="text-muted text-[13px] mb-4 bg-transparent border-0 cursor-pointer p-0">
            ← เปลี่ยนแผน
          </button>

          {/* ยอดชำระ */}
          <div className={`${card} p-5 mb-4 text-center`}>
            {discountPct > 0 && (
              <div className="text-[13px] text-muted line-through mb-0.5">฿{selectedPlan.basePrice}</div>
            )}
            <div className="text-[13px] text-muted mb-1">ยอดชำระ</div>
            <div className={`text-[32px] font-extrabold ${discountPct > 0 ? "text-income" : "text-charcoal"}`}>
              ฿{finalPrice(selectedPlan.basePrice)}
            </div>
            <div className="text-[13px] text-muted">{selectedPlan.label} ({selectedPlan.days} วัน)</div>
            {discountPct > 0 && (
              <div className="text-xs text-income mt-1">
                ประหยัด ฿{selectedPlan.basePrice - finalPrice(selectedPlan.basePrice)} ({discountPct}%)
              </div>
            )}
          </div>

          {/* QR */}
          <div className={`${card} p-5 mb-4 text-center`}>
            <div className="text-[13px] font-semibold text-charcoal mb-3">สแกน PromptPay</div>
            <img
              src={`/api/liff/qr?amount=${finalPrice(selectedPlan.basePrice)}`}
              alt="PromptPay QR"
              className="w-[200px] h-[200px] rounded-lg block mx-auto"
            />
            <div className="text-sm font-semibold text-charcoal mt-2">{process.env.NEXT_PUBLIC_PROMPTPAY_NAME}</div>
            <div className="text-xs text-muted">{process.env.NEXT_PUBLIC_PROMPTPAY_NUMBER}</div>
          </div>

          {/* Steps */}
          <div className={`${card} p-4 mb-4`}>
            <div className="text-[13px] font-semibold text-charcoal mb-3">ขั้นตอนถัดไป</div>
            {["โอนเงินตามยอดข้างต้น", "ถ่ายสลิปให้ชัดเจน", "ส่งสลิปพร้อม User ID ของคุณมาใน LINE chat", "รอรับการยืนยัน (ภายใน 24 ชม.)"].map((s, i) => (
              <div key={i} className="flex gap-2.5 py-1.5 items-start">
                <span className="bg-charcoal text-white rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-bold shrink-0">
                  {i + 1}
                </span>
                <span className="text-[13px] text-charcoal">{s}</span>
              </div>
            ))}
          </div>

          {/* User ID */}
          {lineUserId && (
            <div className="bg-accent-bg rounded-xl p-3.5 text-center">
              <div className="text-xs text-muted mb-1.5">User ID ของคุณ</div>
              <div className="text-[13px] font-semibold text-accent tracking-wide mb-2">{lineUserId}</div>
              <button onClick={copyUserId}
                className={`text-white border-0 rounded-lg px-4 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${copied ? "bg-income" : "bg-accent"}`}>
                {copied ? "คัดลอกแล้ว" : "คัดลอก User ID"}
              </button>
            </div>
          )}
        </>
      )}

      <div className="text-center pt-5 pb-2 text-xs text-muted">🐾 Cooper Financial Butler</div>
    </div>
  );
}
