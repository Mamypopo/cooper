"use client";

import { motion, useReducedMotion } from "framer-motion";
import { fadeIn, motionTransition, staggerContainer, staggerItem } from "../motion";

function Bone({ className = "", dark = false }: { className?: string; dark?: boolean }) {
  return <div className={`cp-skeleton${dark ? " cp-skeleton--dark" : ""} ${className}`.trim()} aria-hidden />;
}

export function DashboardSkeleton() {
  const reduceMotion = useReducedMotion();
  const t = (duration = 0.28) => motionTransition(reduceMotion, duration);

  return (
    <motion.div
      className="cp-page"
      variants={fadeIn}
      initial="hidden"
      animate="show"
      transition={t(0.25)}
      aria-busy="true"
      aria-label="กำลังโหลดข้อมูล"
    >
      <div className="cp-header">
        <div className="cp-header-inner">
          <div className="cp-skeleton-header-block">
            <Bone className="cp-skeleton-line cp-skeleton-line--sm" dark />
            <Bone className="cp-skeleton-line cp-skeleton-line--lg" dark />
          </div>
          <div className="cp-skeleton-header-block cp-skeleton-header-block--end">
            <Bone className="cp-skeleton-line cp-skeleton-line--sm" dark />
            <Bone className="cp-skeleton-line cp-skeleton-line--md" dark />
          </div>
        </div>
      </div>

      <div className="cp-shell">
        <nav className="cp-tabs cp-tabs--skeleton" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="cp-tab-skeleton">
              <Bone className="cp-skeleton-line cp-skeleton-line--tab" />
            </div>
          ))}
        </nav>

        <main className="cp-content">
          <motion.div
            className="cp-tab-panel"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            <motion.div className="cp-stats" variants={staggerContainer}>
              {[1, 2, 3, 4].map((i) => (
                <motion.div key={i} className="cp-stat cp-stat--skeleton" variants={staggerItem} transition={t(0.2)}>
                  <Bone className="cp-skeleton-line cp-skeleton-line--label" />
                  <Bone className="cp-skeleton-line cp-skeleton-line--value" />
                </motion.div>
              ))}
            </motion.div>

            <motion.div className="cp-overview-bottom" variants={staggerContainer}>
              <motion.div className="cp-card" variants={staggerItem} transition={t(0.22)}>
                <Bone className="cp-skeleton-line cp-skeleton-line--title cp-skeleton-inset" />
                <div className="cp-chart-wrap cp-chart-wrap--skeleton">
                  <Bone className="cp-skeleton-chart" />
                </div>
              </motion.div>

              <motion.div className="cp-card" variants={staggerItem} transition={t(0.22)}>
                <Bone className="cp-skeleton-line cp-skeleton-line--title cp-skeleton-inset" />
                {[1, 2, 3].map((i) => (
                  <div key={i} className="cp-row cp-row--skeleton">
                    <div className="cp-skeleton-row-left">
                      <Bone className="cp-skeleton-line cp-skeleton-line--row" />
                      <Bone className="cp-skeleton-line cp-skeleton-line--row-sm" />
                    </div>
                    <Bone className="cp-skeleton-line cp-skeleton-line--amount" />
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </motion.div>

          <p className="cp-skeleton-hint">Cooper กำลังโหลดงับ...</p>
        </main>
      </div>
    </motion.div>
  );
}
