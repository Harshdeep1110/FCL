"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import type { Position } from "@/generated/prisma/enums";

/** Per-position kit colours — gives the pitch FPL-style visual variety. */
const KIT: Record<Position, { body: string; stripe: string; ring: string }> = {
  GK: { body: "#ffb020", stripe: "#7a4a00", ring: "#ffd680" },
  DEF: { body: "#1e5bff", stripe: "#0a2a8a", ring: "#7ea2ff" },
  MID: { body: "#00e1ff", stripe: "#006c85", ring: "#a6f2ff" },
  ATT: { body: "#ff2fb9", stripe: "#8a0060", ring: "#ff9ede" },
};

export interface PitchPlayer {
  id: number;
  name: string;
  subtitle: string;
  position: Position;
  value: string;
  isCaptain: boolean;
}

export interface PitchSlot {
  key: string;
  position: Position;
  player?: PitchPlayer;
}

/** A single jersey (or an empty "+ add" placeholder) on the pitch. */
function Shirt({
  slot,
  onSlotClick,
  onPlayerClick,
}: {
  slot: PitchSlot;
  onSlotClick: (position: Position) => void;
  onPlayerClick: (id: number) => void;
}) {
  const kit = KIT[slot.position];
  const p = slot.player;

  return (
    <motion.div
      layout
      className="flex w-[68px] flex-col items-center sm:w-[84px]"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {p ? (
          <motion.button
            key="filled"
            type="button"
            onClick={() => onPlayerClick(p.id)}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            whileHover={{ y: -3, scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 400, damping: 24 }}
            className="group relative flex w-full flex-col items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ucl-cyan"
            aria-label={`${p.name}, ${p.subtitle}. Tap to manage.`}
          >
            {p.isCaptain && (
              <span className="absolute -left-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-warn text-[10px] font-black text-black shadow">
                C
              </span>
            )}
            <Jersey kit={kit} />
            <span className="mt-1 w-full truncate rounded bg-[#050818]/85 px-1 py-0.5 text-center text-[11px] font-semibold leading-tight">
              {p.name.split(" ").slice(-1)[0]}
            </span>
            <span className="w-full truncate rounded-b bg-ucl-blue/90 px-1 text-center text-[10px] font-mono leading-tight text-white">
              {p.value}
            </span>
          </motion.button>
        ) : (
          <motion.button
            key="empty"
            type="button"
            onClick={() => onSlotClick(slot.position)}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 400, damping: 24 }}
            className="flex w-full flex-col items-center outline-none focus-visible:ring-2 focus-visible:ring-ucl-cyan rounded-lg"
            aria-label={`Add a ${slot.position}`}
          >
            <span className="flex h-[52px] w-[46px] items-center justify-center rounded-lg border-2 border-dashed border-white/40 text-2xl font-light text-white/70 sm:h-[60px] sm:w-[52px]">
              +
            </span>
            <span className="mt-1 rounded bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white/80">
              {slot.position}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Jersey({ kit }: { kit: (typeof KIT)[Position] }) {
  return (
    <svg
      viewBox="0 0 64 60"
      className="h-[52px] w-[52px] drop-shadow-[0_3px_5px_rgba(0,0,0,0.45)] sm:h-[60px] sm:w-[60px]"
      aria-hidden="true"
    >
      <path
        d="M22 4 L8 12 L2 24 L12 30 L14 26 L14 56 L50 56 L50 26 L52 30 L62 24 L56 12 L42 4 C40 10 24 10 22 4 Z"
        fill={kit.body}
        stroke={kit.stripe}
        strokeWidth="1.5"
      />
      <path d="M28 6 C30 9 34 9 36 6" fill="none" stroke={kit.ring} strokeWidth="2" />
      <rect x="27" y="26" width="10" height="30" fill={kit.stripe} opacity="0.55" />
    </svg>
  );
}

/**
 * The football-pitch team-selection view: starting XI arranged in formation
 * rows, with a bench strip below. Purely presentational — the parent supplies
 * slots and handles clicks.
 */
export function Pitch({
  rows,
  bench,
  onSlotClick,
  onPlayerClick,
}: {
  rows: PitchSlot[][];
  bench: PitchSlot[];
  onSlotClick: (position: Position) => void;
  onPlayerClick: (id: number) => void;
}) {
  return (
    <LayoutGroup>
      <div className="overflow-hidden rounded-2xl border border-border shadow-2xl">
        {/* Turf */}
        <div className="pitch-turf relative flex flex-col justify-between gap-2 px-2 py-5 sm:px-6 sm:py-7">
          {/* Field markings */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/15" />
            <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
            <div className="absolute left-1/2 top-0 h-16 w-40 -translate-x-1/2 rounded-b-lg border border-t-0 border-white/15" />
            <div className="absolute bottom-0 left-1/2 h-16 w-40 -translate-x-1/2 rounded-t-lg border border-b-0 border-white/15" />
          </div>

          {rows.map((row, i) => (
            <div
              key={i}
              className="relative z-10 flex items-start justify-center gap-2 sm:gap-5"
            >
              {row.map((slot) => (
                <Shirt
                  key={slot.key}
                  slot={slot}
                  onSlotClick={onSlotClick}
                  onPlayerClick={onPlayerClick}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Bench */}
        <div className="flex items-center gap-2 border-t border-border bg-surface/80 px-2 py-3 backdrop-blur sm:px-6">
          <span className="mr-1 shrink-0 rotate-180 text-[10px] font-bold uppercase tracking-widest text-muted [writing-mode:vertical-rl] sm:[writing-mode:horizontal-tb] sm:rotate-0">
            Bench
          </span>
          <div className="flex flex-1 items-start justify-around gap-2">
            {bench.map((slot) => (
              <Shirt
                key={slot.key}
                slot={slot}
                onSlotClick={onSlotClick}
                onPlayerClick={onPlayerClick}
              />
            ))}
          </div>
        </div>
      </div>
    </LayoutGroup>
  );
}
