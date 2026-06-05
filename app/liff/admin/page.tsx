"use client";

import { useEffect, useState } from "react";

const C = {
  text: "#2C2C2E", sub: "#8E8E93", border: "#E5E5EA", base: "#F5F5F7",
  income: "#7EA184", incomeBg: "#EAF0EB",
  expense: "#C58B7E", expenseBg: "#F7ECE9",
  accent: "#9B8DB4", accentBg: "#F0EDF7",
  transfer: "#6B8296",
};

type Tab = "stats" | "users" | "codes";
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

const inputStyle: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 10, border: `1px solid ${C.border}`,
  fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box",
};
const btn = (bg = C.text): React.CSSProperties => ({
  padding: "7px 14px", borderRadius: 8, border: "none",
  background: bg, color: "#fff", fontSize: 12, fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
});

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

  function authHeaders(extra?: Record<string, string>) {
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extra };
  }

  async function loadAll(t: string) {
    const headers = { Authorization: `Bearer ${t}` };
    const [uRes, cRes] = await Promise.all([
      fetch("/api/liff/admin/users", { headers }),
      fetch("/api/liff/admin/codes", { headers }),
    ]);
    if (!uRes.ok) { setAuthorized(false); return; }
    setAuthorized(true);
    const [uData, cData] = await Promise.all([uRes.json(), cRes.json()]);
    setUsers(uData.users);
    setStats(uData.stats);
    setCodes(cData.codes);
  }

  async function handleActivate(targetLineUserId: string, days: number) {
    await fetch("/api/liff/admin/users", {
      method: "PUT", headers: authHeaders(),
      body: JSON.stringify({ targetLineUserId, action: "activate", days }),
    });
    await loadAll(token);
  }

  async function handleSuspend(targetLineUserId: string) {
    await fetch("/api/liff/admin/users", {
      method: "PUT", headers: authHeaders(),
      body: JSON.stringify({ targetLineUserId, action: "suspend" }),
    });
    await loadAll(token);
  }

  async function handleCreateCode() {
    if (!newCode.code || !newCode.discount) return;
    await fetch("/api/liff/admin/codes", {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({ code: newCode.code, discount: newCode.discount, usageLimit: newCode.usageLimit ? Number(newCode.usageLimit) : null }),
    });
    setNewCode({ code: "", discount: 20, usageLimit: "" });
    await loadAll(token);
  }

  async function handleDeleteCode(code: string) {
    await fetch("/api/liff/admin/codes", {
      method: "DELETE", headers: authHeaders(),
      body: JSON.stringify({ code }),
    });
    await loadAll(token);
  }

  if (authorized === null) return (
    <div className="cp-center">
      <span style={{ fontSize: 13, color: C.sub }}>กำลังโหลด...</span>
    </div>
  );

  if (authorized === false) return (
    <div className="cp-center">
      <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
      <div style={{ fontWeight: 600, color: C.text }}>สำหรับ Admin เท่านั้น</div>
    </div>
  );

  const pendingUsers = users.filter(u => u.role === "PENDING");
  const TABS: [Tab, string][] = [["stats", "ภาพรวม"], ["users", "สมาชิก"], ["codes", "โค้ด"]];

  return (
    <div className="cp-page">

      {/* Header */}
      <div className="cp-header">
        <div className="cp-header-inner">
          <div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Cooper</div>
            <div style={{ color: "#fff", fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>Admin Panel</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="cp-tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={`cp-tab${tab === key ? " active" : ""}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="cp-content">

        {/* Stats */}
        {tab === "stats" && stats && (
          <>
            <div className="cp-stats">
              {[
                { label: "สมาชิก active",  value: stats.active,                                         color: C.income   },
                { label: "รอ approve",      value: pendingUsers.length,                                  color: C.accent   },
                { label: "user ทั้งหมด",   value: stats.total,                                          color: C.transfer },
                { label: "รายรับ/เดือน",   value: `฿${stats.estimatedRevenue.toLocaleString("th-TH")}`, color: C.income   },
              ].map(item => (
                <div key={item.label} className="cp-stat">
                  <div className="cp-stat-label-text">{item.label}</div>
                  <div className="cp-stat-value" style={{ color: item.color, fontSize: 22 }}>{item.value}</div>
                </div>
              ))}
            </div>

            {pendingUsers.length > 0 && (
              <div className="cp-card">
                <div className="cp-card-header" style={{ color: C.accent }}>
                  รอ approve ({pendingUsers.length})
                </div>
                {pendingUsers.map(u => (
                  <div key={u.id} className="cp-row">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{u.displayName ?? "ไม่มีชื่อ"}</div>
                      <div style={{ fontSize: 11, color: C.sub, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.lineUserId}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input type="number" min={1} value={activateDays[u.lineUserId] ?? 30}
                        onChange={e => setActivateDays(d => ({ ...d, [u.lineUserId]: Number(e.target.value) }))}
                        style={{ width: 52, padding: "4px 6px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, textAlign: "center", fontFamily: "inherit" }} />
                      <button onClick={() => handleActivate(u.lineUserId, activateDays[u.lineUserId] ?? 30)} style={btn(C.income)}>
                        เปิด
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Users */}
        {tab === "users" && (
          <div className="cp-card">
            {users.length === 0 && <div className="cp-empty"><span className="cp-empty-text">ยังไม่มีสมาชิก</span></div>}
            {users.map(u => {
              const isActive = u.role === "SUBSCRIBER" && (!u.subscriptionEnds || new Date(u.subscriptionEnds) > new Date());
              const isAdmin  = u.role === "ADMIN";
              const ends     = u.subscriptionEnds
                ? new Date(u.subscriptionEnds).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })
                : null;
              return (
                <div key={u.id} className="cp-row" style={{ background: isActive ? C.incomeBg : "transparent" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {u.displayName ?? "ไม่มีชื่อ"}
                    </div>
                    <div style={{ fontSize: 11, color: C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.lineUserId}</div>
                    {ends && <div style={{ fontSize: 11, color: isActive ? C.income : C.expense }}>ถึง {ends}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {!isAdmin && !isActive && <button onClick={() => handleActivate(u.lineUserId, 30)} style={btn(C.income)}>เปิด</button>}
                    {!isAdmin &&  isActive && <button onClick={() => handleSuspend(u.lineUserId)}      style={btn(C.expense)}>ระงับ</button>}
                    {isAdmin && <span style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>ADMIN</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Codes */}
        {tab === "codes" && (
          <>
            <div className="cp-card" style={{ padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>สร้างโค้ดใหม่</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input value={newCode.code} onChange={e => setNewCode(s => ({ ...s, code: e.target.value.toUpperCase() }))}
                  placeholder="ชื่อโค้ด เช่น SUMMER50" style={inputStyle} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>ส่วนลด (%)</div>
                    <input type="number" min={1} max={100} value={newCode.discount}
                      onChange={e => setNewCode(s => ({ ...s, discount: Number(e.target.value) }))} style={inputStyle} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>จำกัด (ว่าง=ไม่จำกัด)</div>
                    <input type="number" min={1} value={newCode.usageLimit}
                      onChange={e => setNewCode(s => ({ ...s, usageLimit: e.target.value }))}
                      placeholder="ไม่จำกัด" style={inputStyle} />
                  </div>
                </div>
                <button onClick={handleCreateCode} style={{ ...btn(), padding: "10px", width: "100%" }}>
                  สร้างโค้ด
                </button>
              </div>
            </div>

            <div className="cp-card">
              <div className="cp-card-header">โค้ดทั้งหมด ({codes.length})</div>
              {codes.length === 0 && <div className="cp-empty"><span className="cp-empty-text">ยังไม่มีโค้ด</span></div>}
              {codes.map(c => (
                <div key={c.id} className="cp-row" style={{ opacity: c.isActive ? 1 : 0.45 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.5 }}>{c.code}</span>
                      <span style={{ background: C.incomeBg, color: C.income, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>-{c.discount}%</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>
                      ใช้แล้ว {c.usedCount}{c.usageLimit ? `/${c.usageLimit}` : ""} ครั้ง
                    </div>
                  </div>
                  {c.isActive && <button onClick={() => handleDeleteCode(c.code)} style={btn(C.expense)}>ปิด</button>}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="cp-footer">
          <span className="cp-footer-text">🐾 Cooper Financial Butler</span>
        </div>
      </div>
    </div>
  );
}
