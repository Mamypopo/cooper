"use client";

import { useEffect, useState } from "react";

const C = {
  text: "#2C2C2E", sub: "#8E8E93", border: "#E5E5EA", base: "#F5F5F7",
  income: "#7EA184", incomeBg: "#EAF0EB", accent: "#9B8DB4", accentBg: "#F0EDF7",
};

const PLANS = [
  { key: "monthly", label: "รายเดือน", price: 99, days: 30, badge: "" },
  { key: "yearly", label: "รายปี", price: 990, days: 365, badge: "ประหยัด 16%" },
];

export default function SubscribePage() {
  const [lineUserId, setLineUserId] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<typeof PLANS[0] | null>(null);
  const [qrUrl, setQrUrl] = useState("");
  const [step, setStep] = useState<"plan" | "payment">("plan");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_APP_ID! });
        if (!liff.isLoggedIn()) { liff.login(); return; }
        const profile = await liff.getProfile();
        setLineUserId(profile.userId);
      } catch {}
    }
    init();
  }, []);

  function selectPlan(plan: typeof PLANS[0]) {
    setSelectedPlan(plan);
    const payload = btoa(`promptpay:${process.env.NEXT_PUBLIC_PROMPTPAY_NUMBER}:${plan.price}`);
    setQrUrl(`/api/liff/qr?amount=${plan.price}`);
    setStep("payment");
  }

  function copyUserId() {
    navigator.clipboard.writeText(lineUserId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ fontFamily: "Noto Sans Thai, Inter, sans-serif", background: C.base, minHeight: "100vh", maxWidth: 430, margin: "0 auto", padding: 20 }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🐾</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Cooper สมาชิก</div>
        <div style={{ fontSize: 14, color: C.sub, marginTop: 4 }}>ผู้จัดการการเงินส่วนตัว AI</div>
      </div>

      {step === "plan" && (
        <>
          {/* Features */}
          <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.border}`, padding: 16, marginBottom: 20 }}>
            {["บันทึกรายรับ-รายจ่ายด้วยภาษาพูด", "ติดตามหนี้สินและการยืม-คืน", "แจ้งเตือนบิลล่วงหน้า", "รายงานการเงินรายสัปดาห์", "Dashboard วิเคราะห์การเงิน"].map((f) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ color: C.income, fontSize: 16 }}>✓</span>
                <span style={{ fontSize: 13, color: C.text }}>{f}</span>
              </div>
            ))}
          </div>

          {/* Plans */}
          {PLANS.map((plan) => (
            <button key={plan.key} onClick={() => selectPlan(plan)}
              style={{
                width: "100%", marginBottom: 12, padding: 16,
                background: plan.key === "yearly" ? C.text : "#fff",
                border: `1px solid ${plan.key === "yearly" ? C.text : C.border}`,
                borderRadius: 14, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                position: "relative",
              }}>
              {plan.badge && (
                <span style={{
                  position: "absolute", top: -10, right: 16,
                  background: C.income, color: "#fff",
                  fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20,
                }}>
                  {plan.badge}
                </span>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: plan.key === "yearly" ? "#fff" : C.text }}>
                    {plan.label}
                  </div>
                  <div style={{ fontSize: 12, color: plan.key === "yearly" ? "rgba(255,255,255,0.6)" : C.sub, marginTop: 2 }}>
                    {plan.days} วัน
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: plan.key === "yearly" ? "#fff" : C.text }}>
                    ฿{plan.price}
                  </div>
                  <div style={{ fontSize: 11, color: plan.key === "yearly" ? "rgba(255,255,255,0.6)" : C.sub }}>
                    ฿{(plan.price / plan.days * 30).toFixed(0)}/เดือน
                  </div>
                </div>
              </div>
            </button>
          ))}
        </>
      )}

      {step === "payment" && selectedPlan && (
        <>
          <button onClick={() => setStep("plan")}
            style={{ background: "none", border: "none", color: C.sub, fontSize: 13, cursor: "pointer", marginBottom: 16, padding: 0, fontFamily: "inherit" }}>
            ← เปลี่ยนแผน
          </button>

          <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 14, color: C.sub, marginBottom: 4 }}>ยอดชำระ</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: C.text }}>฿{selectedPlan.price}</div>
            <div style={{ fontSize: 13, color: C.sub }}>{selectedPlan.label} ({selectedPlan.days} วัน)</div>
          </div>

          {/* QR Code */}
          <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>สแกน PromptPay</div>
            <img src={`/api/liff/qr?amount=${selectedPlan.price}`} alt="PromptPay QR"
              style={{ width: 200, height: 200, borderRadius: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginTop: 8 }}>
              {process.env.NEXT_PUBLIC_PROMPTPAY_NAME}
            </div>
            <div style={{ fontSize: 12, color: C.sub }}>
              {process.env.NEXT_PUBLIC_PROMPTPAY_NUMBER}
            </div>
          </div>

          {/* Steps */}
          <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.border}`, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>ขั้นตอนถัดไป</div>
            {[
              "โอนเงินตามยอดข้างต้น",
              "ถ่ายสลิปให้ชัดเจน",
              "ส่งสลิปพร้อม User ID ของคุณมาใน LINE chat",
              "รอรับการยืนยัน (ภายใน 24 ชม.)",
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "6px 0", alignItems: "flex-start" }}>
                <span style={{ background: C.text, color: "#fff", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 13, color: C.text }}>{s}</span>
              </div>
            ))}
          </div>

          {/* User ID copy */}
          {lineUserId && (
            <div style={{ background: C.accentBg, borderRadius: 12, padding: 14, textAlign: "center" }}>
              <div style={{ fontSize: 12, color: C.sub, marginBottom: 6 }}>User ID ของคุณ</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.accent, letterSpacing: 0.5, marginBottom: 8 }}>
                {lineUserId}
              </div>
              <button onClick={copyUserId}
                style={{
                  background: copied ? C.income : C.accent, color: "#fff",
                  border: "none", borderRadius: 8, padding: "6px 16px",
                  fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  transition: "background 0.2s",
                }}>
                {copied ? "คัดลอกแล้ว" : "คัดลอก User ID"}
              </button>
            </div>
          )}
        </>
      )}

      <div style={{ textAlign: "center", padding: "20px 0 8px", fontSize: 12, color: C.sub }}>
        🐾 Cooper Financial Butler
      </div>
    </div>
  );
}
