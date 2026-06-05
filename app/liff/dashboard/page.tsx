"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { fadeUp, motionTransition, staggerContainer, staggerItem, tabPanel } from "../motion";
import { DashboardSkeleton } from "./skeleton";
import {
  ACCOUNT_ICONS, Activity, Award, Cat, CpIcon, PiggyBank, Receipt,
  Star, TAB_ICONS, Tag, TrendingDown, TrendingUp, TX_ICONS, Loader2, RefreshCw, Wallet,
} from "./icons";

/* ─── Types ─────────────────────────────────────────────────────── */
interface Account      { name: string; balance: number; type: string; isDefault: boolean }
interface Transaction  { note: string | null; category: string; type: string; amount: number; accountName: string; recordedAt: string }
interface Debt         { personName: string; direction: string; remaining: number; daysAgo: number }
interface Subscription { name: string; amount: number; billingDay: number; daysLeft: number }
interface WeeklyStats  { totalIncome: number; totalExpense: number; savingsRate: number; debtCount: number; topCategory: string; netChange: number; budgetScore: number; liquidityScore: number; grade: string }
interface DashboardData { accounts: Account[]; transactions: Transaction[]; debts: Debt[]; subscriptions: Subscription[]; totalBalance: number; weeklyStats: WeeklyStats }
interface UserSettings  { monthlyBudget: number | null; alertDaysBefore: number; enableSubAlert: boolean; enableDebtAlert: boolean }

/* ─── Color maps (Tailwind class strings) ───────────────────────── */
const TX_COLOR: Record<string, string> = {
  INCOME: "text-income", EXPENSE: "text-expense", TRANSFER: "text-transfer",
  DEBT_LEND: "text-accent", DEBT_BORROW: "text-expense", DEBT_REPAY: "text-income",
};
const TX_BG: Record<string, string> = {
  INCOME: "bg-income-bg", EXPENSE: "bg-expense-bg", TRANSFER: "bg-transfer-bg",
  DEBT_LEND: "bg-accent-bg", DEBT_BORROW: "bg-expense-bg", DEBT_REPAY: "bg-income-bg",
};
const TX_SIGN: Record<string, string> = {
  INCOME: "+", EXPENSE: "-", TRANSFER: "", DEBT_LEND: "-", DEBT_BORROW: "+", DEBT_REPAY: "+",
};
const ACC_COLOR: Record<string, string> = {
  WALLET: "text-income", SAVINGS: "text-transfer", INVESTMENT: "text-accent", CREDIT: "text-expense",
};
const ACC_BG: Record<string, string> = {
  WALLET: "bg-income-bg", SAVINGS: "bg-transfer-bg", INVESTMENT: "bg-accent-bg", CREDIT: "bg-expense-bg",
};

/* Hex values kept only for Chart.js */
const CHART = { income: "#7EA184", text: "#2C2C2E", sub: "#8E8E93", border: "#E5E5EA" };

type Tab = "overview" | "history" | "debts" | "bills" | "settings";
const TAB_LABELS: Record<Tab, string> = { overview: "ภาพรวม", history: "ประวัติ", debts: "หนี้สิน", bills: "บิล", settings: "ตั้งค่า" };

function fmt(n: number)      { return `฿${Math.abs(n).toLocaleString("th-TH")}` }
function fmtDate(d: string)  { return new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short" }) }

/* ─── Shared class strings ──────────────────────────────────────── */
const card  = "bg-white rounded-2xl border border-line overflow-hidden mb-3.5";
const chead = "flex items-center gap-2 px-4 py-3 border-b border-line text-[13px] font-semibold text-charcoal";
const row   = "flex justify-between items-center gap-3 px-4 py-[11px] border-b border-line last:border-0";
const badge = "flex items-center justify-center w-9 h-9 rounded-[10px] shrink-0";
const input = "flex-1 px-3 py-2 rounded-[10px] border border-line text-sm outline-none font-[inherit]";

export default function Dashboard() {
  const [data, setData]             = useState<DashboardData | null>(null);
  const [error, setError]           = useState("");
  const [tab, setTab]               = useState<Tab>("overview");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("ALL");
  const [settings, setSettings]     = useState<UserSettings>({ monthlyBudget: null, alertDaysBefore: 3, enableSubAlert: true, enableDebtAlert: true });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const lineUserIdRef  = useRef("");
  const chartRef       = useRef<HTMLCanvasElement>(null);
  const chartInstance  = useRef<unknown>(null);
  const reduceMotion   = useReducedMotion();
  const t = (dur = 0.28) => motionTransition(reduceMotion, dur);

  async function fetchData(uid: string) {
    const res = await fetch(`/api/liff/data?lineUserId=${uid}`);
    if (!res.ok) throw new Error("ดึงข้อมูลไม่ได้งับ");
    setData(await res.json());
  }

  async function handleSaveSettings() {
    if (!lineUserIdRef.current || settingsSaving) return;
    setSettingsSaving(true);
    try {
      await fetch(`/api/liff/settings?lineUserId=${lineUserIdRef.current}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings),
      });
    } finally { setSettingsSaving(false); }
  }

  async function handleRefresh() {
    if (!lineUserIdRef.current || isRefreshing) return;
    setIsRefreshing(true);
    try { await fetchData(lineUserIdRef.current); } catch {} finally { setIsRefreshing(false); }
  }

  useEffect(() => {
    async function init() {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_APP_ID! });
        if (!liff.isLoggedIn()) { liff.login(); return; }
        const profile = await liff.getProfile();
        lineUserIdRef.current = profile.userId;
        const [d] = await Promise.all([
          fetch(`/api/liff/data?lineUserId=${profile.userId}`).then(r => r.json()),
          import("chart.js"),
          fetch(`/api/liff/settings?lineUserId=${profile.userId}`).then(r => r.json()).then(s => setSettings(s)).catch(() => {}),
        ]);
        setData(d);
      } catch (e) { setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาดงับ"); }
    }
    init();
  }, []);

  useEffect(() => {
    if (!data || tab !== "overview" || !chartRef.current) return;
    let cancelled = false;
    async function drawChart() {
      const { Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip } = await import("chart.js");
      if (cancelled || !chartRef.current) return;
      Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip);
      if (chartInstance.current) (chartInstance.current as { destroy(): void }).destroy();
      const s = data!.weeklyStats;
      const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2.5) : 1;
      chartInstance.current = new Chart(chartRef.current, {
        type: "radar",
        data: {
          labels: ["รายรับ", "รายจ่าย", "การออม", "งบ", "วินัย", "สภาพคล่อง"],
          datasets: [{
            data: [
              Math.min(100, (s.totalIncome / 50000) * 100),
              s.totalIncome > 0 ? Math.max(0, 100 - (s.totalExpense / s.totalIncome) * 100) : 50,
              Math.min(100, s.savingsRate * 2),
              s.budgetScore,
              Math.max(0, 100 - s.debtCount * 20),
              s.liquidityScore,
            ],
            backgroundColor: "rgba(126,161,132,0.22)", borderColor: CHART.income,
            borderWidth: 2.5, pointBackgroundColor: CHART.income, pointBorderColor: "#fff",
            pointBorderWidth: 2, pointRadius: 5, pointHoverRadius: 6,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, devicePixelRatio: dpr,
          animation: { duration: 400 },
          layout: { padding: { top: 8, bottom: 4, left: 4, right: 4 } },
          scales: {
            r: {
              min: 0, max: 100, beginAtZero: true,
              ticks: { display: false, stepSize: 25 },
              grid: { color: "rgba(229,229,234,0.9)", lineWidth: 1 },
              angleLines: { color: "rgba(229,229,234,0.75)", lineWidth: 1 },
              pointLabels: {
                font: { size: 13, weight: "bold", family: "var(--font-noto-sans-thai),Noto Sans Thai,Inter,sans-serif" },
                color: CHART.text, padding: 10,
              },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: CHART.text,
              titleFont: { family: "var(--font-noto-sans-thai),Noto Sans Thai,sans-serif", size: 12 },
              bodyFont:  { family: "var(--font-noto-sans-thai),Noto Sans Thai,sans-serif", size: 12 },
              callbacks: { label: (ctx) => ` ${Math.round(ctx.parsed.r ?? 0)} คะแนน` },
            },
          },
        },
      });
      requestAnimationFrame(() => { (chartInstance.current as { resize?: () => void } | null)?.resize?.(); });
    }
    drawChart();
    const onResize = () => { (chartInstance.current as { resize?: () => void } | null)?.resize?.(); };
    window.addEventListener("resize", onResize);
    return () => { cancelled = true; window.removeEventListener("resize", onResize); };
  }, [data, tab]);

  if (error) return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-dvh p-6 text-center">
      <motion.div animate={reduceMotion ? {} : { y: [0,-6,0] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}>
        <CpIcon icon={Cat} size={40} color={CHART.sub} strokeWidth={1.5} />
      </motion.div>
      <div className="mt-2 text-muted">{error}</div>
    </div>
  );

  if (!data) return <DashboardSkeleton />;

  const s = data.weeklyStats;

  return (
    <motion.div className="flex flex-col min-h-dvh" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={t(0.35)}>

      {/* Header */}
      <motion.div className="bg-charcoal pt-safe pl-safe pr-safe px-5 py-4 shrink-0" variants={fadeUp} initial="hidden" animate="show" transition={t(0.4)}>
        <div className="flex justify-between items-end gap-4">
          <div>
            <div className="flex items-center gap-1 text-white/50 text-[11px] mb-0.5">
              <CpIcon icon={Wallet} size={12} color="rgba(255,255,255,0.5)" />
              ยอดรวมทุกกระเป๋า
            </div>
            <div className="text-white text-[clamp(22px,6vw,34px)] font-bold tracking-tight leading-[1.1]">
              {data.totalBalance < 0 ? "-" : ""}฿{Math.abs(data.totalBalance).toLocaleString("th-TH")}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-end gap-1 text-white/50 text-[11px] mb-0.5">
              <CpIcon icon={Award} size={12} color="rgba(255,255,255,0.5)" />
              เกรดสัปดาห์นี้
            </div>
            <div className="flex items-center gap-2 justify-end">
              <div className="text-white text-[clamp(22px,5vw,28px)] font-extrabold">{s.grade}</div>
              <button onClick={handleRefresh} disabled={isRefreshing}
                className={`bg-white/10 border-0 rounded-lg p-1 px-2 text-white cursor-pointer transition-opacity ${isRefreshing ? "opacity-50 cursor-not-allowed" : ""}`}>
                <CpIcon icon={isRefreshing ? Loader2 : RefreshCw} size={16} color="#fff" className={isRefreshing ? "animate-spin" : undefined} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Shell */}
      <div className="flex flex-col flex-1 min-h-0 md:flex-row md:items-stretch">

        {/* Tabs */}
        <nav className="flex shrink-0 w-full bg-white border-b border-line overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-col md:flex-none md:w-[180px] md:border-b-0 md:border-r md:overflow-y-auto">
          {(["overview","history","debts","bills","settings"] as Tab[]).map((tabKey) => (
            <motion.button key={tabKey} type="button" onClick={() => setTab(tabKey)}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }} transition={t(0.12)}
              className={`flex-1 min-w-[72px] py-3 px-2 text-[13px] border-b-2 cursor-pointer font-[inherit] bg-transparent transition-colors whitespace-nowrap
                md:flex-none md:text-left md:px-6 md:py-3.5 md:border-b-0 md:border-l-[3px] md:text-sm
                ${tabKey === tab
                  ? "font-semibold text-charcoal border-b-charcoal md:border-l-charcoal md:bg-sheet"
                  : "font-normal text-muted border-b-transparent md:border-l-transparent"}`}>
              <span className="inline-flex items-center justify-center gap-1.5 md:justify-start md:w-full">
                <CpIcon icon={TAB_ICONS[tabKey]} size={16} color={tab === tabKey ? CHART.text : CHART.sub} />
                {TAB_LABELS[tabKey]}
              </span>
            </motion.button>
          ))}
        </nav>

        {/* Content */}
        <main className="flex-1 w-full min-w-0 p-4 pb-safe overflow-y-auto md:p-6 md:pb-6">

          {/* Overview — always mounted to preserve canvas */}
          <div className={`w-full ${tab === "overview" ? "block" : "hidden"}`}>
            <div className="grid grid-cols-2 gap-2.5 mb-3.5 md:grid-cols-4">
              {[
                { label: "รายรับสัปดาห์นี้",  value: `+${fmt(s.totalIncome)}`,  colorClass: "text-income",   icon: TrendingUp   },
                { label: "รายจ่ายสัปดาห์นี้", value: `-${fmt(s.totalExpense)}`, colorClass: "text-expense",  icon: TrendingDown },
                { label: "อัตราออม",           value: `${s.savingsRate}%`,       colorClass: "text-transfer", icon: PiggyBank    },
                { label: "หมวดเยอะสุด",        value: s.topCategory,            colorClass: "text-accent",   icon: Tag          },
              ].map((item) => (
                <div key={item.label} className="bg-white rounded-xl p-3 border border-line min-w-0">
                  <div className="flex items-center gap-1 mb-1">
                    <CpIcon icon={item.icon} size={14} color={CHART.sub} />
                    <span className="text-[11px] text-muted">{item.label}</span>
                  </div>
                  <div className={`text-[clamp(13px,3.5vw,15px)] font-bold overflow-hidden text-ellipsis whitespace-nowrap ${item.colorClass}`}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              {/* Radar chart */}
              <div className={card}>
                <div className={chead}><CpIcon icon={Activity} size={16} color={CHART.income} />สมดุลการเงิน 6 มิติ</div>
                <div className="relative w-full h-[clamp(240px,72vw,320px)] max-w-[400px] mx-auto p-2 px-3 pb-4">
                  <canvas ref={chartRef} />
                </div>
              </div>

              {/* Accounts */}
              <div className={card}>
                <div className={chead}><CpIcon icon={Wallet} size={16} color={CHART.text} />กระเป๋าเงิน</div>
                {data.accounts.map((a) => {
                  const AccIcon = ACCOUNT_ICONS[a.type] ?? Wallet;
                  return (
                    <div key={a.name} className={row}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`${badge} ${ACC_BG[a.type] ?? "bg-income-bg"}`}>
                          <CpIcon icon={AccIcon} size={18} color="" className={ACC_COLOR[a.type]} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium flex items-center gap-1">
                            {a.name}
                            {a.isDefault && <CpIcon icon={Star} size={12} color="#9B8DB4" strokeWidth={2} />}
                          </div>
                          <div className="text-[11px] text-muted">{a.type}</div>
                        </div>
                      </div>
                      <div className={`text-[15px] font-semibold ${ACC_COLOR[a.type] ?? "text-income"}`}>
                        {Number(a.balance) < 0 ? "-" : ""}฿{Math.abs(Number(a.balance)).toLocaleString("th-TH")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {tab !== "overview" && (
              <motion.div key={tab} className="w-full" variants={tabPanel} initial="hidden" animate="show" exit="exit" transition={t(0.22)}>

                {/* History */}
                {tab === "history" && (() => {
                  const FILTERS = [
                    { key: "ALL", label: "ทั้งหมด" }, { key: "INCOME", label: "รายรับ" },
                    { key: "EXPENSE", label: "รายจ่าย" }, { key: "DEBT", label: "หนี้สิน" }, { key: "TRANSFER", label: "โอน" },
                  ];
                  const filtered = data.transactions.filter(tx => {
                    if (historyFilter === "ALL") return true;
                    if (historyFilter === "DEBT") return ["DEBT_LEND","DEBT_BORROW","DEBT_REPAY"].includes(tx.type);
                    return tx.type === historyFilter;
                  });
                  return (
                    <motion.div className={card} variants={staggerContainer} initial="hidden" animate="show">
                      <div className={chead}><CpIcon icon={TAB_ICONS.history} size={16} color={CHART.text} />รายการล่าสุด</div>
                      <div className="flex gap-1.5 px-4 py-2 overflow-x-auto border-b border-line [scrollbar-width:none]">
                        {FILTERS.map(f => (
                          <button key={f.key} onClick={() => setHistoryFilter(f.key)}
                            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium cursor-pointer border-0 transition-all ${
                              historyFilter === f.key ? "bg-charcoal text-white" : "bg-sheet text-muted"
                            }`}>
                            {f.label}
                          </button>
                        ))}
                      </div>
                      {filtered.length === 0 && (
                        <div className="flex flex-col items-center gap-2 p-6">
                          <CpIcon icon={Cat} size={28} color={CHART.sub} strokeWidth={1.5} />
                          <span className="text-[13px] text-muted">ไม่มีรายการงับ</span>
                        </div>
                      )}
                      {filtered.map((tx, i) => {
                        const TxIcon = TX_ICONS[tx.type] ?? Receipt;
                        return (
                          <motion.div key={i} className={row} variants={staggerItem} transition={t(0.18)}>
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`${badge} ${TX_BG[tx.type] ?? "bg-sheet"}`}>
                                <CpIcon icon={TxIcon} size={18} color="" className={TX_COLOR[tx.type]} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-medium truncate">{tx.note || tx.category}</div>
                                <div className="text-[11px] text-muted">{tx.category} · {tx.accountName} · {fmtDate(tx.recordedAt)}</div>
                              </div>
                            </div>
                            <div className={`text-[13px] font-semibold shrink-0 ${TX_COLOR[tx.type] ?? "text-charcoal"}`}>
                              {TX_SIGN[tx.type] ?? ""}฿{tx.amount.toLocaleString("th-TH")}
                            </div>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  );
                })()}

                {/* Debts */}
                {tab === "debts" && (
                  <motion.div className={card} variants={staggerContainer} initial="hidden" animate="show">
                    <div className={chead}><CpIcon icon={TAB_ICONS.debts} size={16} color={CHART.text} />หนี้สิน</div>
                    {data.debts.length === 0 && (
                      <div className="flex flex-col items-center gap-2 p-6">
                        <CpIcon icon={Cat} size={28} color={CHART.sub} strokeWidth={1.5} />
                        <span className="text-[13px] text-muted">ไม่มีหนี้ค้างงับ</span>
                      </div>
                    )}
                    {data.debts.map((d, i) => {
                      const isLend = d.direction === "WE_LENT";
                      return (
                        <motion.div key={i} className={`${row} ${isLend ? "bg-income-bg" : "bg-expense-bg"}`} variants={staggerItem} transition={t(0.18)}>
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`${badge} ${isLend ? "bg-income-bg border border-income/10" : "bg-expense-bg border border-expense/10"}`}>
                              <CpIcon icon={isLend ? TX_ICONS.DEBT_REPAY : TX_ICONS.EXPENSE} size={18} color="" className={isLend ? "text-income" : "text-expense"} />
                            </div>
                            <div>
                              <div className="text-[13px] font-medium">{d.personName}</div>
                              <div className={`text-[11px] ${isLend ? "text-income" : "text-expense"}`}>
                                {isLend ? "เราให้ยืม" : "เราเป็นหนี้"} · {d.daysAgo} วันที่แล้ว
                              </div>
                            </div>
                          </div>
                          <div className={`text-sm font-semibold ${isLend ? "text-income" : "text-expense"}`}>{fmt(d.remaining)}</div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}

                {/* Bills */}
                {tab === "bills" && (
                  <motion.div className={card} variants={staggerContainer} initial="hidden" animate="show">
                    <div className={chead}><CpIcon icon={TAB_ICONS.bills} size={16} color={CHART.text} />รอบบิลประจำ</div>
                    {data.subscriptions.length === 0 && (
                      <div className="flex flex-col items-center gap-2 p-6">
                        <CpIcon icon={Cat} size={28} color={CHART.sub} strokeWidth={1.5} />
                        <span className="text-[13px] text-muted">ยังไม่มีบิลงับ</span>
                      </div>
                    )}
                    {data.subscriptions.map((sub, i) => (
                      <motion.div key={i} className={`${row} ${sub.daysLeft <= 3 ? "bg-expense-bg" : ""}`} variants={staggerItem} transition={t(0.18)}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`${badge} ${sub.daysLeft <= 3 ? "bg-expense-bg" : "bg-transfer-bg"}`}>
                            <CpIcon icon={Receipt} size={18} color="" className={sub.daysLeft <= 3 ? "text-expense" : "text-transfer"} />
                          </div>
                          <div>
                            <div className="text-[13px] font-medium">{sub.name}</div>
                            <div className="text-[11px] text-muted">วันที่ {sub.billingDay} ทุกเดือน</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[13px] font-semibold text-expense">฿{sub.amount.toLocaleString("th-TH")}</div>
                          <div className={`text-[11px] ${sub.daysLeft <= 3 ? "text-expense" : "text-muted"}`}>อีก {sub.daysLeft} วัน</div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}

                {/* Settings */}
                {tab === "settings" && (
                  <div className={card}>
                    <div className={chead}><CpIcon icon={TAB_ICONS.settings} size={16} color={CHART.text} />ตั้งค่า</div>
                    <div className="p-4 flex flex-col gap-5">

                      <div>
                        <div className="text-[13px] font-semibold text-charcoal mb-1.5">งบรายเดือน</div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] text-muted">฿</span>
                          <input type="number" value={settings.monthlyBudget ?? ""} placeholder="ยังไม่ได้ตั้ง"
                            onChange={e => setSettings(s => ({ ...s, monthlyBudget: e.target.value ? Number(e.target.value) : null }))}
                            className={input} />
                        </div>
                      </div>

                      <div>
                        <div className="text-[13px] font-semibold text-charcoal mb-1.5">แจ้งเตือนบิลล่วงหน้า</div>
                        <div className="flex items-center gap-2">
                          <input type="number" min={1} max={30} value={settings.alertDaysBefore}
                            onChange={e => setSettings(s => ({ ...s, alertDaysBefore: Math.max(1, Math.min(30, Number(e.target.value))) }))}
                            className="w-16 px-3 py-2 rounded-[10px] border border-line text-sm text-center outline-none font-[inherit]" />
                          <span className="text-[13px] text-muted">วันก่อนถึงกำหนด</span>
                        </div>
                      </div>

                      {([
                        { key: "enableSubAlert"  as const, label: "แจ้งเตือนบิลรายเดือน" },
                        { key: "enableDebtAlert" as const, label: "แจ้งเตือนหนี้ค้างชำระ" },
                      ]).map(({ key, label }) => (
                        <div key={key} className="flex justify-between items-center">
                          <span className="text-[13px] text-charcoal">{label}</span>
                          <button onClick={() => setSettings(s => ({ ...s, [key]: !s[key] }))}
                            className={`relative w-11 h-[26px] rounded-full border-0 cursor-pointer transition-colors ${settings[key] ? "bg-income" : "bg-line"}`}>
                            <span className={`absolute top-[3px] w-5 h-5 rounded-full bg-white shadow-sm transition-[left] ${settings[key] ? "left-[21px]" : "left-[3px]"}`} />
                          </button>
                        </div>
                      ))}

                      <button onClick={handleSaveSettings} disabled={settingsSaving}
                        className={`w-full py-3 rounded-xl border-0 text-white text-sm font-semibold transition-colors cursor-pointer font-[inherit] ${settingsSaving ? "bg-line cursor-not-allowed" : "bg-charcoal"}`}>
                        {settingsSaving ? "กำลังบันทึก..." : "บันทึก"}
                      </button>
                    </div>
                  </div>
                )}

              </motion.div>
            )}
          </AnimatePresence>

          <motion.div className="flex items-center justify-center gap-1.5 py-4 pb-safe"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...t(0.4), delay: reduceMotion ? 0 : 0.15 }}>
            <CpIcon icon={Cat} size={14} color={CHART.sub} strokeWidth={1.5} />
            <span className="text-xs text-muted">Cooper Financial Butler</span>
          </motion.div>
        </main>
      </div>
    </motion.div>
  );
}
