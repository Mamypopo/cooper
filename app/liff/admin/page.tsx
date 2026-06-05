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

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("stats");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [codes, setCodes] = useState<AdminCode[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [newCode, setNewCode] = useState({ code: "", discount: 20, usageLimit: "" });
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
    const uData = await uRes.json();
    const cData = await cRes.json();
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

  const inputStyle = { padding: "8px 12px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" as const };
  const btnStyle = (color = C.text) => ({ padding: "7px 14px", borderRadius: 8, border: "none", background: color, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" });

  if (authorized === null) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontFamily: "Noto Sans Thai, Inter, sans-serif", color: C.sub }}>
      กำลังโหลด...
    </div>
  );

  if (authorized === false) return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100vh", fontFamily: "Noto Sans Thai, Inter, sans-serif", gap: 8 }}>
      <div style={{ fontSize: 32 }}>🔒</div>
      <div style={{ color: C.text, fontWeight: 600 }}>สำหรับ Admin เท่านั้น</div>
    </div>
  );

  const activeUsers = users.filter(u => u.role === "SUBSCRIBER" && (!u.subscriptionEnds || new Date(u.subscriptionEnds) > new Date()));
  const pendingUsers = users.filter(u => u.role === "PENDING");
  const activeCodes = codes.filter(c => c.isActive);

  return (
    <div style={{ fontFamily: "Noto Sans Thai, Inter, sans-serif", background: C.base, minHeight: "100vh", maxWidth: 430, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ background: C.text, padding: "16px 20px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>Admin Panel</div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 }}>Cooper Financial Butler</div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: "#fff", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 56, zIndex: 9 }}>
        {([["stats", "ภาพรวม"], ["users", `สมาชิก`], ["codes", "โค้ด"]] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ flex: 1, padding: "12px 0", fontSize: 13, fontWeight: tab === key ? 600 : 400, color: tab === key ? C.text : C.sub, background: "none", border: "none", borderBottom: `2px solid ${tab === key ? C.text : "transparent"}`, cursor: "pointer", fontFamily: "inherit" }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: 16 }}>

        {/* Stats */}
        {tab === "stats" && stats && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[
                { label: "สมาชิก active", value: stats.active, color: C.income },
                { label: "รอ approve", value: pendingUsers.length, color: C.accent },
                { label: "user ทั้งหมด", value: stats.total, color: C.transfer },
                { label: "รายรับ/เดือน", value: `฿${stats.estimatedRevenue.toLocaleString("th-TH")}`, color: C.income },
              ].map(item => (
                <div key={item.label} style={{ background: "#fff", borderRadius: 12, padding: "14px", border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>

            {pendingUsers.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600, color: C.accent }}>
                  รอ approve ({pendingUsers.length})
                </div>
                {pendingUsers.map(u => (
                  <div key={u.id} style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{u.displayName ?? "ไม่มีชื่อ"}</div>
                      <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{u.lineUserId}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input type="number" min={1} value={activateDays[u.lineUserId] ?? 30}
                        onChange={e => setActivateDays(d => ({ ...d, [u.lineUserId]: Number(e.target.value) }))}
                        style={{ width: 52, padding: "4px 6px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, textAlign: "center", fontFamily: "inherit" }} />
                      <button onClick={() => handleActivate(u.lineUserId, activateDays[u.lineUserId] ?? 30)} style={btnStyle(C.income)}>
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
          <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            {users.map((u, i) => {
              const isActive = u.role === "SUBSCRIBER" && (!u.subscriptionEnds || new Date(u.subscriptionEnds) > new Date());
              const isAdmin = u.role === "ADMIN";
              const ends = u.subscriptionEnds ? new Date(u.subscriptionEnds).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : null;
              return (
                <div key={u.id} style={{ padding: "12px 16px", borderBottom: i < users.length - 1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center", background: isActive ? C.incomeBg : "transparent" }}>
                  <div style={{ minWidth: 0, flex: 1, marginRight: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {u.displayName ?? "ไม่มีชื่อ"}
                    </div>
                    <div style={{ fontSize: 11, color: C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.lineUserId}</div>
                    {ends && <div style={{ fontSize: 11, color: isActive ? C.income : C.expense }}>ถึง {ends}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {!isAdmin && !isActive && (
                      <button onClick={() => handleActivate(u.lineUserId, 30)} style={btnStyle(C.income)}>เปิด</button>
                    )}
                    {!isAdmin && isActive && (
                      <button onClick={() => handleSuspend(u.lineUserId)} style={btnStyle(C.expense)}>ระงับ</button>
                    )}
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
            {/* สร้างโค้ดใหม่ */}
            <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.border}`, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>สร้างโค้ดใหม่</div>
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
                <button onClick={handleCreateCode} style={{ ...btnStyle(), padding: "10px" }}>
                  สร้างโค้ด
                </button>
              </div>
            </div>

            {/* รายการโค้ด */}
            <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600 }}>
                โค้ดทั้งหมด ({codes.length})
              </div>
              {codes.length === 0 && <div style={{ padding: 24, textAlign: "center", color: C.sub, fontSize: 13 }}>ยังไม่มีโค้ด</div>}
              {codes.map((c, i) => (
                <div key={c.id} style={{ padding: "12px 16px", borderBottom: i < codes.length - 1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center", background: c.isActive ? "transparent" : C.base, opacity: c.isActive ? 1 : 0.5 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: 0.5 }}>{c.code}</span>
                      <span style={{ background: C.incomeBg, color: C.income, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>-{c.discount}%</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>
                      ใช้แล้ว {c.usedCount}{c.usageLimit ? `/${c.usageLimit}` : ""} ครั้ง
                    </div>
                  </div>
                  {c.isActive && (
                    <button onClick={() => handleDeleteCode(c.code)} style={btnStyle(C.expense)}>ปิด</button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
