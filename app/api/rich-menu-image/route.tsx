import { ImageResponse } from "next/og";

export const runtime = "edge";

const BUTTONS = [
  { icon: "💳", label: "ดูบัญชี",   bg: "#EAF0EB", color: "#7EA184" },
  { icon: "📋", label: "ดูประวัติ",  bg: "#F0EDF7", color: "#9B8DB4" },
  { icon: "🤝", label: "ดูหนี้สิน", bg: "#F7ECE9", color: "#C58B7E" },
  { icon: "📊", label: "Dashboard",  bg: "#2C2C2E", color: "#ffffff" },
  { icon: "🔔", label: "ดูบิล",     bg: "#EAF0F6", color: "#6B8296" },
  { icon: "🐾", label: "ช่วยเหลือ", bg: "#F5F5F7", color: "#8E8E93" },
];

const BORDER = "#E5E5EA";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 810,
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
          fontFamily: "sans-serif",
        }}
      >
        {[0, 1].map((row) => (
          <div
            key={row}
            style={{
              display: "flex",
              flex: 1,
              borderTop: row === 1 ? `2px solid ${BORDER}` : "none",
            }}
          >
            {BUTTONS.slice(row * 3, row * 3 + 3).map((btn, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 14,
                  background: btn.bg,
                  borderLeft: i > 0 ? `2px solid ${BORDER}` : "none",
                }}
              >
                <div style={{ fontSize: 64, lineHeight: 1 }}>{btn.icon}</div>
                <div
                  style={{
                    fontSize: 34,
                    fontWeight: 700,
                    color: btn.color,
                    letterSpacing: -0.5,
                  }}
                >
                  {btn.label}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    ),
    { width: 1200, height: 810 }
  );
}
