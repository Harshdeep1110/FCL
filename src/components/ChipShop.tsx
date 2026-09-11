"use client";

import { useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { ChipType, Position } from "@/generated/prisma/enums";
import { CHIP_COST, CHIP_TARGET, CHIP_RULES } from "@/lib/config";
import { buyChipAction } from "@/app/chips/actions";

export interface ChipTargetPlayer {
  id: number;
  name: string;
  position: Position;
  clubName: string;
}

const CHIP_META: Record<ChipType, { label: string; effect: string }> = {
  INFLATION: { label: "Inflation", effect: "Raise a club's player prices +10% — affects everyone." },
  BOUNTY: { label: "Bounty", effect: "If the target scores < 4 base pts, collect their points from every owner." },
  BENCH_BOOST: { label: "Bench Boost", effect: "Your bench points count toward your total this week." },
  BANKER: { label: "Banker", effect: "Double a target player's points — for you only." },
  RED_CARD: { label: "Red Card", effect: "Target scores 0 for all participants this matchday." },
  FREE_HIT: { label: "Free Hit", effect: "Unlimited free transfers for one week; squad reverts after." },
};

const ORDER: ChipType[] = ["INFLATION", "BOUNTY", "BENCH_BOOST", "BANKER", "RED_CARD", "FREE_HIT"];

export function ChipShop({
  gameweekId,
  gameweekNumber,
  deadline,
  runningTotal,
  freeChipAvailable,
  chipsUsedThisGw,
  players,
  clubs,
}: {
  gameweekId: string;
  gameweekNumber: number;
  deadline: string;
  runningTotal: number;
  freeChipAvailable: boolean;
  chipsUsedThisGw: ChipType[];
  players: ChipTargetPlayer[];
  clubs: { id: string; name: string }[];
}) {
  const [selected, setSelected] = useState<ChipType | null>(null);
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [clubId, setClubId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const usedCount = chipsUsedThisGw.length;
  const atGwLimit = usedCount >= CHIP_RULES.maxChipsPerGameweek;
  const deadlinePassed = new Date(deadline).getTime() <= Date.now();

  const filteredPlayers = useMemo(
    () =>
      search
        ? players.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 20)
        : players.slice(0, 20),
    [players, search],
  );

  function costFor(chip: ChipType) {
    return freeChipAvailable ? 0 : CHIP_COST[chip];
  }

  function beginBuy(chip: ChipType) {
    setMsg(null);
    const need = CHIP_TARGET[chip];
    if (need === "NONE") {
      confirmBuy(chip, null, null);
    } else {
      setSelected(chip);
      setPlayerId(null);
      setClubId("");
      setSearch("");
    }
  }

  function confirmBuy(chip: ChipType, tPlayer: number | null, tClub: string | null) {
    startTransition(async () => {
      const res = await buyChipAction({
        chipType: chip,
        gameweekId,
        targetPlayerId: tPlayer,
        targetClubId: tClub,
      });
      if (res.ok) {
        setMsg({ ok: true, text: `${CHIP_META[chip].label} purchased ✓` });
        setSelected(null);
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-lg bg-ucl-blue/20 px-3 py-1.5 font-semibold text-ucl-cyan">
          Gameweek {gameweekNumber}
        </span>
        <span className="text-muted">
          Deadline: {new Date(deadline).toLocaleString()}
        </span>
        <span className="text-muted">
          Chips this GW: {usedCount}/{CHIP_RULES.maxChipsPerGameweek}
        </span>
        {freeChipAvailable && (
          <span className="rounded-lg bg-ok/15 px-3 py-1.5 text-ok">
            First chip free 🎁
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {msg && (
          <motion.p
            key={msg.text}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            role="status"
            className={`mb-4 text-sm ${msg.ok ? "text-ok" : "text-bad"}`}
          >
            {msg.text}
          </motion.p>
        )}
      </AnimatePresence>
      {deadlinePassed && (
        <p className="mb-4 text-sm text-warn">The deadline has passed.</p>
      )}

      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.05 } },
        }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {ORDER.map((chip) => {
          const cost = costFor(chip);
          const already = chipsUsedThisGw.includes(chip);
          const disabled = pending || atGwLimit || deadlinePassed;
          return (
            <motion.div
              key={chip}
              variants={{
                hidden: { opacity: 0, y: 16 },
                show: { opacity: 1, y: 0 },
              }}
              whileHover={{ y: -3 }}
              className="card-surface flex flex-col rounded-2xl p-4"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold">{CHIP_META[chip].label}</span>
                <span className="font-mono text-sm text-warn">
                  {cost === 0 ? "FREE" : `${cost} pts`}
                </span>
              </div>
              <p className="mb-3 flex-1 text-xs text-muted">{CHIP_META[chip].effect}</p>
              <motion.button
                whileTap={disabled ? undefined : { scale: 0.96 }}
                onClick={() => beginBuy(chip)}
                disabled={disabled}
                className="rounded-lg bg-gradient-to-r from-ucl-cyan to-ucl-blue px-3 py-1.5 text-sm font-semibold text-[#04122e] transition hover:brightness-110 disabled:opacity-40 disabled:grayscale"
              >
                {already ? "Buy again" : "Buy"}
              </motion.button>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Target picker */}
      <AnimatePresence>
      {selected && CHIP_TARGET[selected] === "PLAYER" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="card-surface mt-6 rounded-2xl border-ucl-blue/40 p-4"
        >
          <div className="mb-2 font-medium">Pick a target for {CHIP_META[selected].label}</div>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player…"
            aria-label="Search player"
            className="mb-2 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-ucl-cyan"
          />
          <ul className="max-h-56 overflow-y-auto">
            {filteredPlayers.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setPlayerId(p.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition ${
                    playerId === p.id ? "bg-ucl-blue text-white" : "hover:bg-surface-2"
                  }`}
                >
                  <span>{p.name}</span>
                  <span className="text-xs text-muted">
                    {p.position} · {p.clubName}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <button
              disabled={!playerId || pending}
              onClick={() => confirmBuy(selected, playerId, null)}
              className="rounded-lg bg-ucl-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ucl-cyan hover:text-[#04122e] disabled:opacity-40"
            >
              Confirm
            </button>
            <button onClick={() => setSelected(null)} className="rounded-lg px-4 py-2 text-sm text-muted hover:text-foreground">
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {selected && CHIP_TARGET[selected] === "CLUB" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="card-surface mt-6 rounded-2xl border-ucl-blue/40 p-4"
        >
          <div className="mb-2 font-medium">Pick a target club for {CHIP_META[selected].label}</div>
          <select
            value={clubId}
            onChange={(e) => setClubId(e.target.value)}
            aria-label="Select target club"
            className="mb-3 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
          >
            <option value="">Select a club…</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              disabled={!clubId || pending}
              onClick={() => confirmBuy(selected, null, clubId)}
              className="rounded-lg bg-ucl-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ucl-cyan hover:text-[#04122e] disabled:opacity-40"
            >
              Confirm
            </button>
            <button onClick={() => setSelected(null)} className="rounded-lg px-4 py-2 text-sm text-muted hover:text-foreground">
              Cancel
            </button>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
