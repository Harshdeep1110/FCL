"use client";

import { motion } from "motion/react";
import { AnimatedNumber } from "@/components/ui/motion";

export interface StandingRow {
  userId: string;
  name: string;
  rank: number;
  gameweeksPlayed: number;
  total: number;
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function StandingsTable({
  rows,
  currentUserId,
}: {
  rows: StandingRow[];
  currentUserId: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.total));

  return (
    <motion.ul
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.05 } },
      }}
      className="flex flex-col gap-2"
    >
      {rows.map((row) => {
        const you = row.userId === currentUserId;
        const pct = Math.round((row.total / max) * 100);
        return (
          <motion.li
            key={row.userId}
            variants={{
              hidden: { opacity: 0, x: -12 },
              show: { opacity: 1, x: 0 },
            }}
            className={`card-surface relative overflow-hidden rounded-xl px-4 py-3 ${
              you ? "ring-1 ring-ucl-cyan" : ""
            }`}
          >
            {/* progress fill */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-ucl-blue/25 to-transparent"
              aria-hidden="true"
            />
            <div className="relative flex items-center gap-3">
              <span className="w-8 shrink-0 text-center font-mono text-lg">
                {MEDAL[row.rank] ?? row.rank}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {row.name}
                {you && (
                  <span className="ml-2 text-xs text-ucl-cyan">you</span>
                )}
              </span>
              <span className="shrink-0 text-xs text-muted">
                {row.gameweeksPlayed} GW
              </span>
              <AnimatedNumber
                value={row.total}
                className="w-14 shrink-0 text-right font-mono text-lg font-bold"
              />
            </div>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}
