"use client";

import { motion, useReducedMotion } from "framer-motion";
import { fadeIn, motionTransition, staggerContainer, staggerItem } from "../motion";

function Bone({ className = "", dark = false }: { className?: string; dark?: boolean }) {
  return (
    <div
      className={`rounded-lg ${dark ? "animate-shimmer-dark" : "animate-shimmer"} ${className}`}
      aria-hidden
    />
  );
}

export function DashboardSkeleton() {
  const reduceMotion = useReducedMotion();
  const t = (dur = 0.28) => motionTransition(reduceMotion, dur);

  return (
    <motion.div
      className="flex flex-col min-h-dvh"
      variants={fadeIn} initial="hidden" animate="show" transition={t(0.25)}
      aria-busy="true" aria-label="กำลังโหลดข้อมูล"
    >
      {/* Header skeleton */}
      <div className="bg-charcoal pt-safe pl-safe pr-safe px-5 py-4 shrink-0">
        <div className="flex justify-between items-end gap-4">
          <div className="flex flex-col gap-0">
            <Bone className="h-2.5 w-[72px] mb-2" dark />
            <Bone className="h-7 w-[min(180px,55vw)]" dark />
          </div>
          <div className="flex flex-col items-end gap-0">
            <Bone className="h-2.5 w-[72px] mb-2" dark />
            <Bone className="h-7 w-10 ml-auto" dark />
          </div>
        </div>
      </div>

      {/* Tabs skeleton */}
      <nav className="flex shrink-0 w-full bg-white border-b border-line pointer-events-none" aria-hidden>
        {[1,2,3,4].map(i => (
          <div key={i} className="flex-1 flex items-center justify-center py-3 px-2">
            <Bone className="h-3 w-12" />
          </div>
        ))}
      </nav>

      {/* Content skeleton */}
      <main className="flex-1 p-4 overflow-y-auto">
        <motion.div className="w-full" variants={staggerContainer} initial="hidden" animate="show">

          {/* Stats grid */}
          <motion.div className="grid grid-cols-2 gap-2.5 mb-3.5 md:grid-cols-4" variants={staggerContainer}>
            {[1,2,3,4].map(i => (
              <motion.div key={i} className="bg-white rounded-xl p-3 border border-line min-h-[58px]" variants={staggerItem} transition={t(0.2)}>
                <Bone className="h-2.5 w-[64%] mb-2.5" />
                <Bone className="h-4 w-[48%]" />
              </motion.div>
            ))}
          </motion.div>

          <motion.div className="grid grid-cols-1 gap-3.5 md:grid-cols-2" variants={staggerContainer}>
            {/* Chart card */}
            <motion.div className="bg-white rounded-2xl border border-line overflow-hidden mb-3.5" variants={staggerItem} transition={t(0.22)}>
              <Bone className="h-3.5 w-[42%] mx-4 my-3.5" />
              <div className="flex items-center justify-center p-4">
                <Bone className="w-[min(220px,70vw)] h-[min(220px,70vw)] max-h-[240px] rounded-full" />
              </div>
              <p className="text-center mb-2 text-xs text-muted">Cooper กำลังโหลดงับ...</p>
            </motion.div>

            {/* Accounts card */}
            <motion.div className="bg-white rounded-2xl border border-line overflow-hidden mb-3.5" variants={staggerItem} transition={t(0.22)}>
              <Bone className="h-3.5 w-[42%] mx-4 my-3.5" />
              {[1,2,3].map(i => (
                <div key={i} className="flex justify-between items-center gap-3 px-4 py-[11px] border-b border-[#f2f2f7]">
                  <div className="flex-1 min-w-0">
                    <Bone className="h-3 w-[55%] mb-1.5" />
                    <Bone className="h-2.5 w-[70%]" />
                  </div>
                  <Bone className="h-3.5 w-16 shrink-0" />
                </div>
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
      </main>
    </motion.div>
  );
}
