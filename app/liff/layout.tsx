import type { Viewport } from "next";
import "./liff.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function LiffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col flex-1 w-full min-h-dvh bg-sheet overflow-x-hidden font-[var(--font-noto-sans-thai),var(--font-inter),'Noto_Sans_Thai',Inter,sans-serif] text-charcoal">
      {children}
    </div>
  );
}
