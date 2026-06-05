"use client";

import { useEffect, useState } from "react";

type Tab      = "stats" | "users" | "codes";
type UserRole = "ADMIN" | "SUBSCRIBER" | "PENDING";

interface AdminUser {
  id: string; lineUserId: string; displayName: string | null;
  role: UserRole; subscriptionEnds: string | null; createdAt: string;
}
interface AdminCode {
  id: string; code: string; discount: number;
  usageLimit: number | null; usedCount: number; isActive: boolean; expiresAt: string | null;
}
interface Stats { total: number; active: number; estimatedRevenue: number }

const input = "w-full px-3 py-2 rounded-[10px] border border-line text-[13px] outline-none font-[inherit] box-border";
const btn   = (color: string) => `px-3.5 py-1.5 rounded-lg border-0 text-white text-xs font-semibold cursor-pointer font-[inherit] shrink-0 ${color}`;

export default function AdminPage() {
  const [token, setToken]           = useState("");
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tab, setTab]               = useState<Tab>("stats");
  const [users, setUsers]           = useState<AdminUser[]>([]);
  const [codes, setCodes]           = useState<AdminCode[]>([]);
  const [stats, setStats]           = useState<Stats | null>(null);
  const [newCode, setNewCode]       = useState({ code: "", discount: 20, usageLimit: "" });
  const [activateDays, setActivateDays] = useState<Record<string, number>>({});

  useEffect(() => {
    async function init() {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ADMIN_ID! });
        if (!liff.isLoggedIn()) { liff.login(); return; }
        const accessToken = liff.getAccessToken();
        if (!accessToken) { setAuthorized(false); return; }
        setToken(accessToken);
        await loadAll(accessToken);
      } catch { setAuthorized(false); }
    }
    init();
  }, []);

  function authHeaders() {
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  async function loadAll(t: string) {
    const h = { Authorization: `Bearer ${t}` };
    const [uRes, cRes] = await Promise.all([
      fetch("/api/liff/admin/users", { headers: h }),
      fetch("/api/liff/admin/codes", { headers: h }),
    ]);
    if (!uRes.ok) { setAuthorized(false); return; }
    setAuthorized(true);
    const [uData, cData] = await Promise.all([uRes.json(), cRes.json()]);
    setUsers(uData.users); setStats(uData.stats); setCodes(cData.codes);
  }

  async function handleActivate(targetLineUserId: string, days: number) {
    await fetch("/api/liff/admin/users", { method: "PUT", headers: authHeaders(), body: JSON.stringify({ targetLineUserId, action: "activate", days }) });
    await loadAll(token);
  }
  async function handleSuspend(targetLineUserId: string) {
    await fetch("/api/liff/admin/users", { method: "PUT", headers: authHeaders(), body: JSON.stringify({ targetLineUserId, action: "suspend" }) });
    await loadAll(token);
  }
  async function handleCreateCode() {
    if (!newCode.code || !newCode.discount) return;
    await fetch("/api/liff/admin/codes", { method: "POST", headers: authHeaders(), body: JSON.stringify({ code: newCode.code, discount: newCode.discount, usageLimit: newCode.usageLimit ? Number(newCode.usageLimit) : null }) });
    setNewCode({ code: "", discount: 20, usageLimit: "" });
    await loadAll(token);
  }
  async function handleDeleteCode(code: string) {
    await fetch("/api/liff/admin/codes", { method: "DELETE", headers: authHeaders(), body: JSON.stringify({ code }) });
    await loadAll(token);
  }

  if (authorized === null) return (
    <div className="flex flex-1 items-center justify-center min-h-dvh text-[13px] text-muted">กำลังโหลด...</div>
  );
  if (authorized === false) return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-dvh gap-2">
      <div className="text-[32px]">🔒</div>
      <div className="font-semibold text-charcoal">สำหรับ Admin เท่านั้น</div>
    </div>
  );

  const pendingUsers = users.filter(u => u.role === "PENDING");
  const TABS: [Tab, string][] = [["stats", "ภาพรวม"], ["users", "สมาชิก"], ["codes", "โค้ด"]];

  const card  = "bg-white rounded-2xl border border-line overflow-hidden mb-3.5";
  const row   = "flex justify-between items-center px-4 py-3 border-b border-line last:border-0";
  const chead = "flex items-center gap-2 px-4 py-3 border-b border-line text-[13px] font-semibold text-charcoal";

  return (
    <div className="flex flex-col min-h-dvh bg-sheet">

      {/* Header */}
      <div className="bg-charcoal pt-safe pl-safe pr-safe px-5 py-4 shrink-0">
        <div className="text-white/50 text-[11px]">Cooper</div>
        <div className="text-white text-lg font-bold leading-tight">Admin Panel</div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-line shrink-0 overflow-x-auto scrollbar-none">
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-3 text-[13px] cursor-pointer font-[inherit] bg-transparent border-x-0 border-t-0 border-b-2 transition-colors ${
              tab === key ? "font-semibold text-charcoal border-b-charcoal" : "font-normal text-muted border-b-transparent"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 pb-safe overflow-y-auto">

        {/* Stats */}
        {tab === "stats" && stats && (
          <>
            <div className="grid grid-cols-2 gap-2.5 mb-3.5">
              {[
                { label: "สมาชิก active",  value: stats.active,                                         color: "text-income"   },
                { label: "รอ approve",      value: pendingUsers.length,                                  color: "text-accent"   },
                { label: "user ทั้งหมด",   value: stats.total,                                          color: "text-transfer" },
                { label: "รายรับ/เดือน",   value: `฿${stats.estimatedRevenue.toLocaleString("th-TH")}`, color: "text-income"   },
              ].map(item => (
                <div key={item.label} className="bg-white rounded-xl p-3.5 border border-line">
                  <div className="text-[11px] text-muted mb-1">{item.label}</div>
                  <div className={`text-[22px] font-bold ${item.color}`}>{item.value}</div>
                </div>
              ))}
            </div>

            {pendingUsers.length > 0 && (
              <div className={card}>
                <div className={`${chead} text-accent`}>รอ approve ({pendingUsers.length})</div>
                {pendingUsers.map(u => (
                  <div key={u.id} className={row}>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium">{u.displayName ?? "ไม่มีชื่อ"}</div>
                      <div className="text-[11px] text-muted mt-0.5 truncate">{u.lineUserId}</div>
                    </div>
                    <div className="flex gap-1.5 items-center">
                      <input type="number" min={1} value={activateDays[u.lineUserId] ?? 30}
                        onChange={e => setActivateDays(d => ({ ...d, [u.lineUserId]: Number(e.target.value) }))}
                        className="w-13 px-1.5 py-1 rounded-lg border border-line text-xs text-center font-[inherit]" />
                      <button onClick={() => handleActivate(u.lineUserId, activateDays[u.lineUserId] ?? 30)} className={btn("bg-income")}>เปิด</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Users */}
        {tab === "users" && (
          <div className={card}>
            {users.length === 0 && <div className="flex flex-col items-center p-6 text-[13px] text-muted">ยังไม่มีสมาชิก</div>}
            {users.map(u => {
              const isActive = u.role === "SUBSCRIBER" && (!u.subscriptionEnds || new Date(u.subscriptionEnds) > new Date());
              const isAdminU = u.role === "ADMIN";
              const ends     = u.subscriptionEnds
                ? new Date(u.subscriptionEnds).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })
                : null;
              return (
                <div key={u.id} className={`${row} ${isActive ? "bg-income-bg" : ""}`}>
                  <div className="min-w-0 flex-1 mr-2">
                    <div className="text-[13px] font-medium truncate">{u.displayName ?? "ไม่มีชื่อ"}</div>
                    <div className="text-[11px] text-muted truncate">{u.lineUserId}</div>
                    {ends && <div className={`text-[11px] ${isActive ? "text-income" : "text-expense"}`}>ถึง {ends}</div>}
                  </div>
                  <div className="flex gap-1.5">
                    {!isAdminU && !isActive && <button onClick={() => handleActivate(u.lineUserId, 30)} className={btn("bg-income")}>เปิด</button>}
                    {!isAdminU &&  isActive && <button onClick={() => handleSuspend(u.lineUserId)}      className={btn("bg-expense")}>ระงับ</button>}
                    {isAdminU && <span className="text-[11px] text-accent font-semibold">ADMIN</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Codes */}
        {tab === "codes" && (
          <>
            <div className="bg-white rounded-2xl border border-line p-4 mb-3.5">
              <div className="text-[13px] font-semibold text-charcoal mb-3">สร้างโค้ดใหม่</div>
              <div className="flex flex-col gap-2">
                <input value={newCode.code} onChange={e => setNewCode(s => ({ ...s, code: e.target.value.toUpperCase() }))}
                  placeholder="ชื่อโค้ด เช่น SUMMER50" className={input} />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[11px] text-muted mb-1">ส่วนลด (%)</div>
                    <input type="number" min={1} max={100} value={newCode.discount}
                      onChange={e => setNewCode(s => ({ ...s, discount: Number(e.target.value) }))} className={input} />
                  </div>
                  <div>
                    <div className="text-[11px] text-muted mb-1">จำกัด (ว่าง=ไม่จำกัด)</div>
                    <input type="number" min={1} value={newCode.usageLimit}
                      onChange={e => setNewCode(s => ({ ...s, usageLimit: e.target.value }))}
                      placeholder="ไม่จำกัด" className={input} />
                  </div>
                </div>
                <button onClick={handleCreateCode} className="w-full py-2.5 rounded-xl bg-charcoal text-white text-[13px] font-semibold cursor-pointer border-0">
                  สร้างโค้ด
                </button>
              </div>
            </div>

            <div className={card}>
              <div className={chead}>โค้ดทั้งหมด ({codes.length})</div>
              {codes.length === 0 && <div className="flex flex-col items-center p-6 text-[13px] text-muted">ยังไม่มีโค้ด</div>}
              {codes.map(c => (
                <div key={c.id} className={`${row} ${!c.isActive ? "opacity-45" : ""}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold tracking-wide">{c.code}</span>
                      <span className="bg-income-bg text-income text-[11px] font-bold px-2 py-0.5 rounded-full">-{c.discount}%</span>
                    </div>
                    <div className="text-[11px] text-muted mt-0.5">
                      ใช้แล้ว {c.usedCount}{c.usageLimit ? `/${c.usageLimit}` : ""} ครั้ง
                    </div>
                  </div>
                  {c.isActive && <button onClick={() => handleDeleteCode(c.code)} className={btn("bg-expense")}>ปิด</button>}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex items-center justify-center gap-1.5 pt-4 pb-2 text-xs text-muted">
          🐾 Cooper Financial Butler
        </div>
      </div>
    </div>
  );
}
