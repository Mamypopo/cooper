import type { Viewport } from "next";
import "./liff.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function LiffLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="cp-app">{children}</div>;
}
