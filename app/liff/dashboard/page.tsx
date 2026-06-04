"use client";

import { useEffect, useRef, useState } from "react";

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

type Tab = "overview" | "history" | "debts" | "bills";
const TAB_LABELS: Record<Tab, string> = { overview: "ภาพรวม", history: "ประวัติ", debts: "หนี้สิน", bills: "บิล" };

/* ─── Component ───────────────────────────────────────────────── */
export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<unknown>(null);

  useEffect(() => {
    async function init() {
      try {
        const liffModule = await import("@line/liff");
        const liff = liffModule.default;
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_APP_ID! });
        if (!liff.isLoggedIn()) { liff.login(); return; }
        const profile = await liff.getProfile();
        const res = await fetch(`/api/liff/data?lineUserId=${profile.userId}`);
        if (!res.ok) throw new Error("ดึงข้อมูลไม่ได้งับ");
        setData(await res.json());
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
      const expenseScore = s.totalIncome > 0 ? Math.max(0, 100 - (s.totalExpense / s.totalIncome) * 100) : 50;
      const debtScore = Math.max(0, 100 - s.debtCount * 20);
      chartInstance.current = new Chart(chartRef.current!, {
        type: "radar",
        data: {
          labels: ["รายรับ", "รายจ่าย", "การออม", "ลงทุน", "วินัย", "เป้าหมาย"],
          datasets: [{
            data: [Math.min(100, (s.totalIncome / 50000) * 100), expenseScore, savingsScore, 50, debtScore, 70],
            backgroundColor: "rgba(126,161,132,0.15)",
            borderColor: C.income, borderWidth: 1.5,
            pointBackgroundColor: C.income, pointBorderColor: "#fff", pointBorderWidth: 2, pointRadius: 4,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
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
    <div className="cp-page">
      <div className="cp-center">
        <div style={{ fontSize: 32 }}>🐾</div>
        <div style={{ marginTop: 8, color: C.sub }}>{error}</div>
      </div>
    </div>
  );

  if (!data) return (
    <div className="cp-page">
      <div className="cp-center">
        <div style={{ fontSize: 40 }}>🐾</div>
        <div style={{ marginTop: 8, fontSize: 14, color: C.sub }}>Cooper กำลังโหลดงับ...</div>
      </div>
    </div>
  );

  const s = data.weeklyStats;

  return (
    <div className="cp-page">
        {/* Header */}
        <div className="cp-header">
          <div className="cp-header-inner">
            <div>
              <div className="cp-header-balance">ยอดรวมทุกกระเป๋า</div>
              <div className="cp-header-amount">
                {data.totalBalance < 0 ? "-" : ""}฿{Math.abs(data.totalBalance).toLocaleString("th-TH")}
              </div>
            </div>
            <div>
              <div className="cp-header-grade-label">เกรดสัปดาห์นี้</div>
              <div className="cp-header-grade">{s.grade}</div>
            </div>
          </div>
        </div>

        {/* Shell: tabs + content */}
        <div className="cp-shell">

          {/* Tabs / Sidebar */}
          <nav className="cp-tabs">
            {(["overview", "history", "debts", "bills"] as Tab[]).map((t) => (
              <button key={t} className={`cp-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
                {TAB_LABELS[t]}
              </button>
            ))}
          </nav>

          {/* Content */}
          <main className="cp-content">

            {/* ── Overview ── */}
            {tab === "overview" && (
              <>
                <div className="cp-stats">
                  {[
                    { label: "รายรับสัปดาห์นี้", value: `+${fmt(s.totalIncome)}`, color: C.income },
                    { label: "รายจ่ายสัปดาห์นี้", value: `-${fmt(s.totalExpense)}`, color: C.expense },
                    { label: "อัตราออม", value: `${s.savingsRate}%`, color: C.transfer },
                    { label: "หมวดเยอะสุด", value: s.topCategory, color: C.accent },
                  ].map((item) => (
                    <div key={item.label} className="cp-stat">
                      <div className="cp-stat-label">{item.label}</div>
                      <div className="cp-stat-value" style={{ color: item.color }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                <div className="cp-overview-bottom">
                  <div className="cp-card">
                    <div className="cp-card-header">สมดุลการเงิน 6 มิติ</div>
                    <div className="cp-chart-wrap">
                      <canvas ref={chartRef} />
                    </div>
                  </div>

                  <div className="cp-card">
                    <div className="cp-card-header">กระเป๋าเงิน</div>
                    {data.accounts.map((a) => {
                      const color = a.type === "WALLET" ? C.income : a.type === "SAVINGS" ? C.transfer : C.accent;
                      return (
                        <div key={a.name} className="cp-row">
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}{a.isDefault ? " ⭐" : ""}</div>
                            <div style={{ fontSize: 11, color: C.sub }}>{a.type}</div>
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 600, color }}>
                            {Number(a.balance) < 0 ? "-" : ""}฿{Math.abs(Number(a.balance)).toLocaleString("th-TH")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* ── History ── */}
            {tab === "history" && (
              <div className="cp-card">
                <div className="cp-card-header">รายการล่าสุด</div>
                {data.transactions.length === 0 && <div className="cp-empty">ยังไม่มีรายการงับ 🐾</div>}
                {data.transactions.map((t, i) => (
                  <div key={i} className="cp-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.note || t.category}
                      </div>
                      <div style={{ fontSize: 11, color: C.sub }}>{t.category} · {t.accountName} · {fmtDate(t.recordedAt)}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TYPE_COLOR[t.type] ?? C.text, flexShrink: 0, marginLeft: 12 }}>
                      {TYPE_SIGN[t.type] ?? ""}฿{t.amount.toLocaleString("th-TH")}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Debts ── */}
            {tab === "debts" && (
              <div className="cp-card">
                <div className="cp-card-header">หนี้สิน</div>
                {data.debts.length === 0 && <div className="cp-empty">ไม่มีหนี้ค้างงับ 🐾</div>}
                {data.debts.map((d, i) => {
                  const isLend = d.direction === "WE_LENT";
                  return (
                    <div key={i} className="cp-row" style={{ background: isLend ? C.incomeBg : C.expenseBg }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{d.personName}</div>
                        <div style={{ fontSize: 11, color: isLend ? C.income : C.expense }}>
                          {isLend ? "เราให้ยืม" : "เราเป็นหนี้"} · {d.daysAgo} วันที่แล้ว
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: isLend ? C.income : C.expense }}>
                        {fmt(d.remaining)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Bills ── */}
            {tab === "bills" && (
              <div className="cp-card">
                <div className="cp-card-header">รอบบิลประจำ</div>
                {data.subscriptions.length === 0 && <div className="cp-empty">ยังไม่มีบิลงับ 🐾</div>}
                {data.subscriptions.map((sub, i) => (
                  <div key={i} className="cp-row" style={{ background: sub.daysLeft <= 3 ? C.expenseBg : "transparent" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{sub.name}</div>
                      <div style={{ fontSize: 11, color: C.sub }}>วันที่ {sub.billingDay} ทุกเดือน</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.expense }}>฿{sub.amount.toLocaleString("th-TH")}</div>
                      <div style={{ fontSize: 11, color: sub.daysLeft <= 3 ? C.expense : C.sub }}>อีก {sub.daysLeft} วัน</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="cp-footer">🐾 Cooper Financial Butler</div>
          </main>
        </div>
    </div>
  );
}
