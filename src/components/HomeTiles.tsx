"use client";

import Link from "next/link";
import { motion } from "motion/react";

export interface NavTile {
  href: string;
  title: string;
  desc: string;
  icon: string;
  accent: "cyan" | "blue" | "magenta" | "violet";
}

const ACCENT: Record<NavTile["accent"], string> = {
  cyan: "from-ucl-cyan/20 hover:border-ucl-cyan",
  blue: "from-ucl-blue/20 hover:border-ucl-blue",
  magenta: "from-ucl-magenta/20 hover:border-ucl-magenta",
  violet: "from-ucl-violet/20 hover:border-ucl-violet",
};

export function HomeTiles({ tiles }: { tiles: NavTile[] }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      {tiles.map((t) => (
        <motion.div
          key={t.href}
          variants={{
            hidden: { opacity: 0, y: 18 },
            show: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
            },
          }}
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.98 }}
        >
          <Link
            href={t.href}
            className={`card-surface group relative flex items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-br to-transparent p-5 transition-colors ${ACCENT[t.accent]}`}
          >
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-2xl transition-transform group-hover:scale-110"
              aria-hidden="true"
            >
              {t.icon}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">{t.title}</span>
              <span className="block truncate text-sm text-muted">{t.desc}</span>
            </span>
            <span className="ml-auto text-muted transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}
