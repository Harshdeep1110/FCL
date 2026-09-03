"use client";

import { useMemo, useState, useTransition } from "react";
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
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-4 text-sm">
        <span className="rounded bg-slate-800 px-3 py-1.5">Gameweek {gameweekNumber}</span>
        <span className="text-slate-400">
          Deadline: {new Date(deadline).toLocaleString()}
        </span>
        <span className="text-slate-400">
          Chips this GW: {usedCount}/{CHIP_RULES.maxChipsPerGameweek}
        </span>
        {freeChipAvailable && (
          <span className="rounded bg-emerald-600/30 px-3 py-1.5 text-emerald-300">
            First chip free 🎁
          </span>
        )}
      </div>

      {msg && (
        <p className={`mb-4 text-sm ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>
          {msg.text}
        </p>
      )}
      {deadlinePassed && (
        <p className="mb-4 text-sm text-amber-400">The deadline has passed.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ORDER.map((chip) => {
          const cost = costFor(chip);
          const already = chipsUsedThisGw.includes(chip);
          const disabled = pending || atGwLimit || deadlinePassed;
          return (
            <div
              key={chip}
              className="flex flex-col rounded-lg border border-slate-800 bg-slate-900/50 p-4"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold">{CHIP_META[chip].label}</span>
                <span className="font-mono text-sm text-amber-400">
                  {cost === 0 ? "FREE" : `${cost} pts`}
                </span>
              </div>
              <p className="mb-3 flex-1 text-xs text-slate-400">{CHIP_META[chip].effect}</p>
              <button
                onClick={() => beginBuy(chip)}
                disabled={disabled}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium hover:bg-indigo-500 disabled:opacity-40"
              >
                {already ? "Buy again" : "Buy"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Target picker */}
      {selected && CHIP_TARGET[selected] === "PLAYER" && (
        <div className="mt-6 rounded-lg border border-indigo-800 bg-slate-900 p-4">
          <div className="mb-2 font-medium">Pick a target for {CHIP_META[selected].label}</div>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player…"
            className="mb-2 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
          <ul className="max-h-56 overflow-y-auto">
            {filteredPlayers.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setPlayerId(p.id)}
                  className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm ${
                    playerId === p.id ? "bg-indigo-600" : "hover:bg-slate-800"
                  }`}
                >
                  <span>{p.name}</span>
                  <span className="text-xs text-slate-400">
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
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              Confirm
            </button>
            <button onClick={() => setSelected(null)} className="rounded px-4 py-2 text-sm text-slate-400">
              Cancel
            </button>
          </div>
        </div>
      )}

      {selected && CHIP_TARGET[selected] === "CLUB" && (
        <div className="mt-6 rounded-lg border border-indigo-800 bg-slate-900 p-4">
          <div className="mb-2 font-medium">Pick a target club for {CHIP_META[selected].label}</div>
          <select
            value={clubId}
            onChange={(e) => setClubId(e.target.value)}
            className="mb-3 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
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
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              Confirm
            </button>
            <button onClick={() => setSelected(null)} className="rounded px-4 py-2 text-sm text-slate-400">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
