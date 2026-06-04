"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

/* ─── Types ───────────────────────────────────────────────────── */
interface Account { name: string; balance: number; type: string; isDefault: boolean }
interface Transaction { note: string | null; category: string; type: string; amount: number; accountName: string; recordedAt: string }
interface Debt { personName: string; direction: string; remaining: number; daysAgo: number }
interface Subscription { name: string; amount: number; billingDay: number; daysLeft: number }
interface WeeklyStats { totalIncome: number; totalExpense: number; savingsRate: number; debtCount: number; topCategory: string; netChange: number; grade: string }

interface DashboardData {
  accounts: Account[];
  transactions: Transaction[];
  debts: Debt[];
  subscriptions: Subscription[];
  totalBalance: number;
  weeklyStats: WeeklyStats;
}

/* ─── Colors ──────────────────────────────────────────────────── */
const C = {
  income: "#7EA184", incomeBg: "#EAF0EB",
  expense: "#C58B7E", expenseBg: "#F7ECE9",
  transfer: "#6B8296", transferBg: "#EAF0F6",
  accent: "#9B8DB4", accentBg: "#F0EDF7",
  text: "#2C2C2E", sub: "#8E8E93", border: "#E5E5EA", base: "#F5F5F7",
};

const TYPE_COLOR: Record<string, string> = {
  INCOME: C.income, EXPENSE: C.expense, TRANSFER: C.transfer,
  DEBT_LEND: C.accent, DEBT_REPAY: C.income,
};
const TYPE_SIGN: Record<string, string> = {
  INCOME: "+", EXPENSE: "-", TRANSFER: "", DEBT_LEND: "-", DEBT_REPAY: "+",
};

function fmt(n: number) { return `฿${Math.abs(n).toLocaleString("th-TH")}` }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

/* ─── Component ───────────────────────────────────────────────── */
export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"overview" | "history" | "debts" | "bills">("overview");
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<unknown>(null);

  useEffect(() => {
    let liff: typeof import("@line/liff").default | null = null;

    async function init() {
      try {
        const liffModule = await import("@line/liff");
        liff = liffModule.default;
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_APP_ID! });

        if (!liff.isLoggedIn()) { liff.login(); return; }

        const profile = await liff.getProfile();
        const res = await fetch(`/api/liff/data?lineUserId=${profile.userId}`);
        if (!res.ok) throw new Error("ดึงข้อมูลไม่ได้งับ");
        const json = await res.json();
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาดงับ");
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!data || tab !== "overview" || !chartRef.current) return;

    async function drawChart() {
      const { Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip } =
        await import("chart.js");
      Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip);

      if (chartInstance.current) (chartInstance.current as { destroy(): void }).destroy();

      const s = data!.weeklyStats;
      const savingsScore = Math.min(100, s.savingsRate * 2);
      const expenseScore = s.totalIncome > 0
        ? Math.max(0, 100 - (s.totalExpense / s.totalIncome) * 100)
        : 50;
      const debtScore = Math.max(0, 100 - s.debtCount * 20);

      chartInstance.current = new Chart(chartRef.current!, {
        type: "radar",
        data: {
          labels: ["รายรับ", "รายจ่าย", "การออม", "ลงทุน", "วินัย", "เป้าหมาย"],
          datasets: [{
            data: [
              Math.min(100, (s.totalIncome / 50000) * 100),
              expenseScore,
              savingsScore,
              50,
              debtScore,
              70,
            ],
            backgroundColor: "rgba(126,161,132,0.15)",
            borderColor: C.income,
            borderWidth: 1.5,
            pointBackgroundColor: C.income,
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 4,
          }],
        },
        options: {
          responsive: true,
          scales: {
            r: {
              min: 0, max: 100,
              ticks: { display: false },
              grid: { color: C.border },
              angleLines: { color: C.border },
              pointLabels: { font: { size: 11, family: "Noto Sans Thai, Inter" }, color: C.sub },
            },
          },
          plugins: { legend: { display: false } },
        },
      });
    }
    drawChart();
  }, [data, tab]);

  if (error) return (
    <div style={{ padding: 32, textAlign: "center", color: C.sub, fontFamily: "Noto Sans Thai, Inter" }}>
      <div style={{ fontSize: 32 }}>🐾</div>
      <div style={{ marginTop: 8 }}>{error}</div>
    </div>
  );

  if (!data) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontFamily: "Noto Sans Thai, Inter", color: C.sub }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40 }}>🐾</div>
        <div style={{ marginTop: 8, fontSize: 14 }}>Cooper กำลังโหลดงับ...</div>
      </div>
    </div>
  );

  const s = data.weeklyStats;

  return (
    <>
      <Script src="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" />
      <div style={{ fontFamily: "Noto Sans Thai, Inter, sans-serif", background: C.base, minHeight: "100vh", maxWidth: 430, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ background: C.text, padding: "20px 20px 16px", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 2 }}>ยอดรวมทุกกระเป๋า</div>
              <div style={{ color: "#fff", fontSize: 28, fontWeight: 700, letterSpacing: -1 }}>
                {data.totalBalance < 0 ? "-" : ""}฿{Math.abs(data.totalBalance).toLocaleString("th-TH")}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>เกรดสัปดาห์นี้</div>
              <div style={{ color: "#fff", fontSize: 26, fontWeight: 800 }}>{s.grade}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", background: "#fff", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 76, zIndex: 9 }}>
          {(["overview", "history", "debts", "bills"] as const).map((t) => {
            const labels = { overview: "ภาพรวม", history: "ประวัติ", debts: "หนี้สิน", bills: "บิล" };
            return (
              <button key={t} onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: "12px 0", fontSize: 13, fontWeight: tab === t ? 600 : 400,
                  color: tab === t ? C.text : C.sub,
                  borderBottom: tab === t ? `2px solid ${C.text}` : "2px solid transparent",
                  background: "none", border: "none",
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                {labels[t]}
              </button>
            );
          })}
        </div>

        <div style={{ padding: 16 }}>

          {/* ── Overview ── */}
          {tab === "overview" && (
            <>
              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {[
                  { label: "รายรับ", value: `+${fmt(s.totalIncome)}`, color: C.income },
                  { label: "รายจ่าย", value: `-${fmt(s.totalExpense)}`, color: C.expense },
                  { label: "อัตราออม", value: `${s.savingsRate}%`, color: C.transfer },
                  { label: "หมวดเยอะสุด", value: s.topCategory, color: C.accent },
                ].map((item) => (
                  <div key={item.label} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Radar */}
              <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.border}`, padding: 16, marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>สมดุลการเงิน 6 มิติ</div>
                <canvas ref={chartRef} style={{ maxHeight: 220 }} />
              </div>

              {/* Accounts */}
              <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600 }}>กระเป๋าเงิน</div>
                {data.accounts.map((a) => {
                  const color = a.type === "WALLET" ? C.income : a.type === "SAVINGS" ? C.transfer : C.accent;
                  return (
                    <div key={a.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", borderBottom: `1px solid ${C.border}` }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}{a.isDefault ? " ⭐" : ""}</div>
                        <div style={{ fontSize: 11, color: C.sub }}>{a.type}</div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 600, color }}>{Number(a.balance) < 0 ? "-" : ""}฿{Math.abs(Number(a.balance)).toLocaleString("th-TH")}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── History ── */}
          {tab === "history" && (
            <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600 }}>รายการล่าสุด</div>
              {data.transactions.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: C.sub, fontSize: 13 }}>ยังไม่มีรายการงับ 🐾</div>
              )}
              {data.transactions.map((t, i) => {
                const color = TYPE_COLOR[t.type] ?? C.text;
                const sign = TYPE_SIGN[t.type] ?? "";
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.note || t.category}</div>
                      <div style={{ fontSize: 11, color: C.sub }}>{t.category} · {t.accountName} · {fmtDate(t.recordedAt)}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color, flexShrink: 0, marginLeft: 8 }}>{sign}฿{t.amount.toLocaleString("th-TH")}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Debts ── */}
          {tab === "debts" && (
            <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600 }}>หนี้สิน</div>
              {data.debts.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: C.sub, fontSize: 13 }}>ไม่มีหนี้ค้างงับ 🐾</div>
              )}
              {data.debts.map((d, i) => {
                const isLend = d.direction === "WE_LENT";
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", borderBottom: `1px solid ${C.border}`, background: isLend ? C.incomeBg : C.expenseBg }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{d.personName}</div>
                      <div style={{ fontSize: 11, color: isLend ? C.income : C.expense }}>{isLend ? "เราให้ยืม" : "เราเป็นหนี้"} · {d.daysAgo} วันที่แล้ว</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: isLend ? C.income : C.expense }}>{fmt(d.remaining)}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Bills ── */}
          {tab === "bills" && (
            <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600 }}>รอบบิลประจำ</div>
              {data.subscriptions.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: C.sub, fontSize: 13 }}>ยังไม่มีบิลงับ 🐾</div>
              )}
              {data.subscriptions.map((s, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", borderBottom: `1px solid ${C.border}`, background: s.daysLeft <= 3 ? C.expenseBg : "transparent" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: C.sub }}>วันที่ {s.billingDay} ทุกเดือน</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.expense }}>฿{s.amount.toLocaleString("th-TH")}</div>
                    <div style={{ fontSize: 11, color: s.daysLeft <= 3 ? C.expense : C.sub }}>อีก {s.daysLeft} วัน</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ textAlign: "center", padding: "16px 0 8px", fontSize: 12, color: C.sub }}>🐾 Cooper Financial Butler</div>
        </div>
      </div>
    </>
  );
}
