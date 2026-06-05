"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  fadeUp,
  motionTransition,
  staggerContainer,
  staggerItem,
  tabPanel,
} from "../motion";
import { DashboardSkeleton } from "./skeleton";
import {
  ACCOUNT_ICONS,
  Activity,
  Award,
  Cat,
  CpIcon,
  PiggyBank,
  Receipt,
  Star,
  TAB_ICONS,
  Tag,
  TrendingDown,
  TrendingUp,
  TX_ICONS,
  Wallet,
} from "./icons";

/* ─── Types ───────────────────────────────────────────────────── */
interface Account { name: string; balance: number; type: string; isDefault: boolean }
interface Transaction { note: string | null; category: string; type: string; amount: number; accountName: string; recordedAt: string }
interface Debt { personName: string; direction: string; remaining: number; daysAgo: number }
interface Subscription { name: string; amount: number; billingDay: number; daysLeft: number }
interface WeeklyStats { totalIncome: number; totalExpense: number; savingsRate: number; debtCount: number; topCategory: string; netChange: number; budgetScore: number; liquidityScore: number; grade: string }

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
  DEBT_LEND: C.accent, DEBT_BORROW: C.expense, DEBT_REPAY: C.income,
};
const TYPE_SIGN: Record<string, string> = {
  INCOME: "+", EXPENSE: "-", TRANSFER: "", DEBT_LEND: "-", DEBT_BORROW: "+", DEBT_REPAY: "+",
};
const TYPE_BG: Record<string, string> = {
  INCOME: C.incomeBg, EXPENSE: C.expenseBg, TRANSFER: C.transferBg,
  DEBT_LEND: C.accentBg, DEBT_BORROW: C.expenseBg, DEBT_REPAY: C.incomeBg,
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
  const reduceMotion = useReducedMotion();
  const t = (duration = 0.28) => motionTransition(reduceMotion, duration);

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

    let cancelled = false;

    async function drawChart() {
      const { Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip } =
        await import("chart.js");
      if (cancelled || !chartRef.current) return;

      Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip);
      if (chartInstance.current) (chartInstance.current as { destroy(): void }).destroy();

      const s = data!.weeklyStats;
      const savingsScore = Math.min(100, s.savingsRate * 2);
      const expenseScore = s.totalIncome > 0 ? Math.max(0, 100 - (s.totalExpense / s.totalIncome) * 100) : 50;
      const debtScore = Math.max(0, 100 - s.debtCount * 20);
      const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2.5) : 1;

      chartInstance.current = new Chart(chartRef.current, {
        type: "radar",
        data: {
          labels: ["รายรับ", "รายจ่าย", "การออม", "งบ", "วินัย", "สภาพคล่อง"],
          datasets: [{
            data: [Math.min(100, (s.totalIncome / 50000) * 100), expenseScore, savingsScore, s.budgetScore, debtScore, s.liquidityScore],
            backgroundColor: "rgba(126, 161, 132, 0.22)",
            borderColor: C.income,
            borderWidth: 2.5,
            pointBackgroundColor: C.income,
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          devicePixelRatio: dpr,
          animation: { duration: 400 },
          layout: { padding: { top: 8, bottom: 4, left: 4, right: 4 } },
          scales: {
            r: {
              min: 0,
              max: 100,
              beginAtZero: true,
              ticks: { display: false, stepSize: 25 },
              grid: { color: "rgba(229, 229, 234, 0.9)", lineWidth: 1 },
              angleLines: { color: "rgba(229, 229, 234, 0.75)", lineWidth: 1 },
              pointLabels: {
                font: { size: 13, weight: "bold", family: "var(--font-noto-sans-thai), Noto Sans Thai, Inter, sans-serif" },
                color: C.text,
                padding: 10,
              },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: C.text,
              titleFont: { family: "var(--font-noto-sans-thai), Noto Sans Thai, sans-serif", size: 12 },
              bodyFont: { family: "var(--font-noto-sans-thai), Noto Sans Thai, sans-serif", size: 12 },
              callbacks: {
                label: (ctx) => ` ${Math.round(ctx.parsed.r ?? 0)} คะแนน`,
              },
            },
          },
        },
      });

      requestAnimationFrame(() => {
        (chartInstance.current as { resize?: () => void } | null)?.resize?.();
      });
    }

    drawChart();

    const onResize = () => {
      (chartInstance.current as { resize?: () => void } | null)?.resize?.();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
    };
  }, [data, tab]);

  if (error) return (
    <div className="cp-page">
      <motion.div
        className="cp-center"
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={t(0.35)}
      >
        <motion.div
          animate={reduceMotion ? {} : { y: [0, -6, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <CpIcon icon={Cat} size={40} color={C.sub} strokeWidth={1.5} />
        </motion.div>
        <div style={{ marginTop: 8, color: C.sub }}>{error}</div>
      </motion.div>
    </div>
  );

  if (!data) return <DashboardSkeleton />;

  const s = data.weeklyStats;

  return (
    <motion.div
      className="cp-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={t(0.35)}
    >
      <motion.div
        className="cp-header"
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={t(0.4)}
      >
        <div className="cp-header-inner">
          <div>
            <div className="cp-header-balance cp-header-label">
              <CpIcon icon={Wallet} size={12} color="rgba(255,255,255,0.5)" />
              ยอดรวมทุกกระเป๋า
            </div>
            <div className="cp-header-amount">
              {data.totalBalance < 0 ? "-" : ""}฿{Math.abs(data.totalBalance).toLocaleString("th-TH")}
            </div>
          </div>
          <div>
            <div className="cp-header-grade-label cp-header-label" style={{ justifyContent: "flex-end" }}>
              <CpIcon icon={Award} size={12} color="rgba(255,255,255,0.5)" />
              เกรดสัปดาห์นี้
            </div>
            <div className="cp-header-grade">{s.grade}</div>
          </div>
        </div>
      </motion.div>

      <div className="cp-shell">
        <nav className="cp-tabs">
          {(["overview", "history", "debts", "bills"] as Tab[]).map((tabKey) => (
            <motion.button
              key={tabKey}
              type="button"
              className={`cp-tab${tab === tabKey ? " active" : ""}`}
              onClick={() => setTab(tabKey)}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              transition={t(0.12)}
            >
              <span className="cp-tab-inner">
                <CpIcon
                  icon={TAB_ICONS[tabKey]}
                  size={16}
                  color={tab === tabKey ? C.text : C.sub}
                />
                {TAB_LABELS[tabKey]}
              </span>
            </motion.button>
          ))}
        </nav>

        <main className="cp-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              className="cp-tab-panel"
              variants={tabPanel}
              initial="hidden"
              animate="show"
              exit="exit"
              transition={t(0.22)}
            >
              {tab === "overview" && (
                <>
                  <motion.div
                    className="cp-stats"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                  >
                    {[
                      { label: "รายรับสัปดาห์นี้", value: `+${fmt(s.totalIncome)}`, color: C.income, icon: TrendingUp },
                      { label: "รายจ่ายสัปดาห์นี้", value: `-${fmt(s.totalExpense)}`, color: C.expense, icon: TrendingDown },
                      { label: "อัตราออม", value: `${s.savingsRate}%`, color: C.transfer, icon: PiggyBank },
                      { label: "หมวดเยอะสุด", value: s.topCategory, color: C.accent, icon: Tag },
                    ].map((item) => (
                      <motion.div key={item.label} className="cp-stat" variants={staggerItem} transition={t(0.2)}>
                        <div className="cp-stat-label">
                          <CpIcon icon={item.icon} size={14} color={C.sub} />
                          <span className="cp-stat-label-text">{item.label}</span>
                        </div>
                        <div className="cp-stat-value" style={{ color: item.color }}>{item.value}</div>
                      </motion.div>
                    ))}
                  </motion.div>

                  <motion.div
                    className="cp-overview-bottom"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                  >
                    <motion.div className="cp-card" variants={staggerItem} transition={t(0.25)}>
                      <div className="cp-card-header">
                        <CpIcon icon={Activity} size={16} color={C.income} />
                        สมดุลการเงิน 6 มิติ
                      </div>
                      <div className="cp-chart-wrap">
                        <canvas ref={chartRef} />
                      </div>
                    </motion.div>

                    <motion.div className="cp-card" variants={staggerItem} transition={t(0.25)}>
                      <div className="cp-card-header">
                        <CpIcon icon={Wallet} size={16} color={C.transfer} />
                        กระเป๋าเงิน
                      </div>
                      {data.accounts.map((a) => {
                        const color = a.type === "WALLET" ? C.income : a.type === "SAVINGS" ? C.transfer : C.accent;
                        const bg = a.type === "WALLET" ? C.incomeBg : a.type === "SAVINGS" ? C.transferBg : C.accentBg;
                        const AccIcon = ACCOUNT_ICONS[a.type] ?? Wallet;
                        return (
                          <div key={a.name} className="cp-row">
                            <div className="cp-row-body">
                              <div className="cp-icon-badge" style={{ background: bg }}>
                                <CpIcon icon={AccIcon} size={18} color={color} />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                                  {a.name}
                                  {a.isDefault && <CpIcon icon={Star} size={12} color={C.accent} strokeWidth={2} />}
                                </div>
                                <div style={{ fontSize: 11, color: C.sub }}>{a.type}</div>
                              </div>
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 600, color }}>
                              {Number(a.balance) < 0 ? "-" : ""}฿{Math.abs(Number(a.balance)).toLocaleString("th-TH")}
                            </div>
                          </div>
                        );
                      })}
                    </motion.div>
                  </motion.div>
                </>
              )}

              {tab === "history" && (
                <motion.div
                  className="cp-card"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                >
                  <div className="cp-card-header">
                    <CpIcon icon={TAB_ICONS.history} size={16} color={C.text} />
                    รายการล่าสุด
                  </div>
                  {data.transactions.length === 0 && (
                    <div className="cp-empty">
                      <CpIcon icon={Cat} size={28} color={C.sub} strokeWidth={1.5} />
                      <span className="cp-empty-text">ยังไม่มีรายการงับ</span>
                    </div>
                  )}
                  {data.transactions.map((tx, i) => {
                    const TxIcon = TX_ICONS[tx.type] ?? Receipt;
                    const txColor = TYPE_COLOR[tx.type] ?? C.text;
                    return (
                    <motion.div key={i} className="cp-row" variants={staggerItem} transition={t(0.18)}>
                      <div className="cp-row-body">
                        <div className="cp-icon-badge" style={{ background: TYPE_BG[tx.type] ?? C.base }}>
                          <CpIcon icon={TxIcon} size={18} color={txColor} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {tx.note || tx.category}
                          </div>
                          <div style={{ fontSize: 11, color: C.sub }}>{tx.category} · {tx.accountName} · {fmtDate(tx.recordedAt)}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: txColor, flexShrink: 0 }}>
                        {TYPE_SIGN[tx.type] ?? ""}฿{tx.amount.toLocaleString("th-TH")}
                      </div>
                    </motion.div>
                    );
                  })}
                </motion.div>
              )}

              {tab === "debts" && (
                <motion.div
                  className="cp-card"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                >
                  <div className="cp-card-header">
                    <CpIcon icon={TAB_ICONS.debts} size={16} color={C.text} />
                    หนี้สิน
                  </div>
                  {data.debts.length === 0 && (
                    <div className="cp-empty">
                      <CpIcon icon={Cat} size={28} color={C.sub} strokeWidth={1.5} />
                      <span className="cp-empty-text">ไม่มีหนี้ค้างงับ</span>
                    </div>
                  )}
                  {data.debts.map((d, i) => {
                    const isLend = d.direction === "WE_LENT";
                    const DebtIcon = isLend ? TX_ICONS.DEBT_REPAY : TX_ICONS.EXPENSE;
                    return (
                      <motion.div
                        key={i}
                        className="cp-row"
                        style={{ background: isLend ? C.incomeBg : C.expenseBg }}
                        variants={staggerItem}
                        transition={t(0.18)}
                      >
                        <div className="cp-row-body">
                          <div className="cp-icon-badge" style={{ background: isLend ? C.incomeBg : C.expenseBg, border: `1px solid ${isLend ? C.income : C.expense}22` }}>
                            <CpIcon icon={DebtIcon} size={18} color={isLend ? C.income : C.expense} />
                          </div>
                          <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{d.personName}</div>
                          <div style={{ fontSize: 11, color: isLend ? C.income : C.expense }}>
                            {isLend ? "เราให้ยืม" : "เราเป็นหนี้"} · {d.daysAgo} วันที่แล้ว
                          </div>
                          </div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: isLend ? C.income : C.expense }}>
                          {fmt(d.remaining)}
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}

              {tab === "bills" && (
                <motion.div
                  className="cp-card"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                >
                  <div className="cp-card-header">
                    <CpIcon icon={TAB_ICONS.bills} size={16} color={C.text} />
                    รอบบิลประจำ
                  </div>
                  {data.subscriptions.length === 0 && (
                    <div className="cp-empty">
                      <CpIcon icon={Cat} size={28} color={C.sub} strokeWidth={1.5} />
                      <span className="cp-empty-text">ยังไม่มีบิลงับ</span>
                    </div>
                  )}
                  {data.subscriptions.map((sub, i) => (
                    <motion.div
                      key={i}
                      className="cp-row"
                      style={{ background: sub.daysLeft <= 3 ? C.expenseBg : "transparent" }}
                      variants={staggerItem}
                      transition={t(0.18)}
                    >
                      <div className="cp-row-body">
                        <div className="cp-icon-badge" style={{ background: sub.daysLeft <= 3 ? C.expenseBg : C.transferBg }}>
                          <CpIcon icon={Receipt} size={18} color={sub.daysLeft <= 3 ? C.expense : C.transfer} />
                        </div>
                        <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{sub.name}</div>
                        <div style={{ fontSize: 11, color: C.sub }}>วันที่ {sub.billingDay} ทุกเดือน</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.expense }}>฿{sub.amount.toLocaleString("th-TH")}</div>
                        <div style={{ fontSize: 11, color: sub.daysLeft <= 3 ? C.expense : C.sub }}>อีก {sub.daysLeft} วัน</div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>

          <motion.div
            className="cp-footer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...t(0.4), delay: reduceMotion ? 0 : 0.15 }}
          >
            <CpIcon icon={Cat} size={14} color={C.sub} strokeWidth={1.5} />
            <span className="cp-footer-text">Cooper Financial Butler</span>
          </motion.div>
        </main>
      </div>
    </motion.div>
  );
}
