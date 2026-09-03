"use client";

import { useMemo, useState, useTransition } from "react";
import type { Position, SquadStage } from "@/generated/prisma/enums";
import { SQUAD_RULES } from "@/lib/config";
import {
  summarize,
  validateSquad,
  type DraftEntry,
} from "@/lib/squad-validation";
import { saveDraft } from "@/app/draft/actions";

export interface PoolPlayer {
  id: number;
  name: string;
  position: Position;
  price: number;
  clubId: string;
  clubName: string;
}

interface SelState {
  isStarting: boolean;
  isCaptain: boolean;
}

const POSITIONS: Position[] = ["GK", "DEF", "MID", "ATT"];

export function DraftBoard({
  pool,
  initialSelection,
  stage,
}: {
  pool: PoolPlayer[];
  initialSelection: { playerId: number; isStarting: boolean; isCaptain: boolean }[];
  stage: SquadStage;
}) {
  const rules = SQUAD_RULES[stage];
  const poolById = useMemo(() => new Map(pool.map((p) => [p.id, p])), [pool]);

  const [selection, setSelection] = useState<Record<number, SelState>>(() => {
    const init: Record<number, SelState> = {};
    for (const s of initialSelection) {
      init[s.playerId] = { isStarting: s.isStarting, isCaptain: s.isCaptain };
    }
    return init;
  });

  const [posFilter, setPosFilter] = useState<Position | "ALL">("ALL");
  const [clubFilter, setClubFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const entries: DraftEntry[] = useMemo(
    () =>
      Object.entries(selection).map(([id, s]) => {
        const p = poolById.get(Number(id))!;
        return {
          playerId: p.id,
          position: p.position,
          price: p.price,
          clubId: p.clubId,
          isStarting: s.isStarting,
          isCaptain: s.isCaptain,
        };
      }),
    [selection, poolById],
  );

  const summary = useMemo(() => summarize(entries, stage), [entries, stage]);
  const validation = useMemo(
    () => validateSquad(entries, stage),
    [entries, stage],
  );

  const clubs = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of pool) map.set(p.clubId, p.clubName);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [pool]);

  function toggleSelect(p: PoolPlayer) {
    setSaveMsg(null);
    setSelection((prev) => {
      const next = { ...prev };
      if (next[p.id]) {
        delete next[p.id];
        return next;
      }
      // Auto-place as a starter if that keeps within lineup bounds, else bench.
      const startingAtPos = entries.filter(
        (e) => e.isStarting && e.position === p.position,
      ).length;
      const canStart =
        summary.startingCount < rules.startingSize &&
        startingAtPos < rules.startingBounds[p.position].max;
      next[p.id] = { isStarting: canStart, isCaptain: false };
      return next;
    });
  }

  function setStarting(id: number, isStarting: boolean) {
    setSaveMsg(null);
    setSelection((prev) => ({
      ...prev,
      [id]: {
        isStarting,
        // Dropping to the bench can't remain captain.
        isCaptain: isStarting ? prev[id].isCaptain : false,
      },
    }));
  }

  function setCaptain(id: number) {
    setSaveMsg(null);
    setSelection((prev) => {
      const next: Record<number, SelState> = {};
      for (const [k, v] of Object.entries(prev)) {
        next[Number(k)] = { ...v, isCaptain: Number(k) === id };
      }
      return next;
    });
  }

  function onSave() {
    setSaveMsg(null);
    startTransition(async () => {
      const res = await saveDraft({
        stage,
        entries: entries.map((e) => ({
          playerId: e.playerId,
          isStarting: e.isStarting,
          isCaptain: e.isCaptain,
        })),
      });
      if (res.ok) {
        setSaveMsg({ ok: true, text: "Squad saved ✓" });
      } else {
        setSaveMsg({ ok: false, text: res.errors.join(" ") });
      }
    });
  }

  const filteredPool = pool.filter((p) => {
    if (posFilter !== "ALL" && p.position !== posFilter) return false;
    if (clubFilter !== "ALL" && p.clubId !== clubFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[1fr_380px]">
      {/* Player pool */}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            <FilterChip
              active={posFilter === "ALL"}
              onClick={() => setPosFilter("ALL")}
            >
              All
            </FilterChip>
            {POSITIONS.map((pos) => (
              <FilterChip
                key={pos}
                active={posFilter === pos}
                onClick={() => setPosFilter(pos)}
              >
                {pos}
              </FilterChip>
            ))}
          </div>
          <select
            value={clubFilter}
            onChange={(e) => setClubFilter(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
          >
            <option value="ALL">All clubs</option>
            {clubs.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player…"
            className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
          />
        </div>

        <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-slate-800">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-900 text-left text-slate-400">
              <tr>
                <th className="px-3 py-2">Player</th>
                <th className="px-3 py-2">Club</th>
                <th className="px-3 py-2">Pos</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {filteredPool.map((p) => {
                const selected = !!selection[p.id];
                const clubCount = summary.perClubCounts[p.clubId] ?? 0;
                const posFull =
                  summary.positionCounts[p.position] >=
                  rules.positionCounts[p.position];
                const blocked =
                  !selected &&
                  (summary.totalPlayers >= rules.squadSize ||
                    posFull ||
                    clubCount >= rules.maxPerClub ||
                    summary.budgetRemaining < p.price);
                return (
                  <tr
                    key={p.id}
                    className="border-t border-slate-800 hover:bg-slate-900/50"
                  >
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2 text-slate-400">{p.clubName}</td>
                    <td className="px-3 py-2 text-slate-400">{p.position}</td>
                    <td className="px-3 py-2 text-right">
                      {p.price.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => toggleSelect(p)}
                        disabled={blocked}
                        className={`rounded px-2 py-1 text-xs font-medium ${
                          selected
                            ? "bg-red-600/80 hover:bg-red-600"
                            : blocked
                              ? "cursor-not-allowed bg-slate-800 text-slate-600"
                              : "bg-indigo-600 hover:bg-indigo-500"
                        }`}
                      >
                        {selected ? "Remove" : "Add"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Squad panel */}
      <aside className="flex flex-col gap-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-sm text-slate-400">Budget</span>
            <span
              className={`font-mono text-lg ${
                summary.budgetRemaining < 0 ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {summary.budgetRemaining.toFixed(1)}M
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            {POSITIONS.map((pos) => (
              <div key={pos} className="rounded bg-slate-800 py-1.5">
                <div className="text-slate-400">{pos}</div>
                <div className="font-mono">
                  {summary.positionCounts[pos]}/{rules.positionCounts[pos]}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-400">
            <span>
              Squad {summary.totalPlayers}/{rules.squadSize}
            </span>
            <span>
              Starting {summary.startingCount}/{rules.startingSize}
            </span>
          </div>
        </div>

        {/* Selected players by position */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          {summary.totalPlayers === 0 ? (
            <p className="text-sm text-slate-500">
              No players selected yet. Add from the pool.
            </p>
          ) : (
            POSITIONS.map((pos) => {
              const inPos = entries.filter((e) => e.position === pos);
              if (inPos.length === 0) return null;
              return (
                <div key={pos} className="mb-3 last:mb-0">
                  <div className="mb-1 text-xs font-semibold text-slate-500">
                    {pos}
                  </div>
                  <ul className="flex flex-col gap-1">
                    {inPos.map((e) => {
                      const p = poolById.get(e.playerId)!;
                      return (
                        <li
                          key={e.playerId}
                          className="flex items-center justify-between gap-2 rounded bg-slate-800/60 px-2 py-1.5 text-sm"
                        >
                          <span className="flex-1 truncate">
                            {p.name}
                            <span className="ml-1 text-xs text-slate-500">
                              {p.clubName}
                            </span>
                          </span>
                          <button
                            onClick={() =>
                              setStarting(e.playerId, !e.isStarting)
                            }
                            className={`rounded px-1.5 py-0.5 text-xs ${
                              e.isStarting
                                ? "bg-emerald-600/70"
                                : "bg-slate-700 text-slate-400"
                            }`}
                          >
                            {e.isStarting ? "XI" : "Bench"}
                          </button>
                          <button
                            onClick={() => setCaptain(e.playerId)}
                            disabled={!e.isStarting}
                            className={`w-6 rounded px-1 py-0.5 text-xs font-bold ${
                              e.isCaptain
                                ? "bg-amber-500 text-black"
                                : "bg-slate-700 text-slate-400 disabled:opacity-40"
                            }`}
                            title="Captain"
                          >
                            C
                          </button>
                          <button
                            onClick={() => toggleSelect(p)}
                            className="text-slate-500 hover:text-red-400"
                          >
                            ✕
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </div>

        {/* Validation + save */}
        {!validation.ok && summary.totalPlayers > 0 && (
          <ul className="rounded-lg border border-amber-800/50 bg-amber-950/30 p-3 text-xs text-amber-300">
            {validation.errors.map((err, i) => (
              <li key={i}>• {err}</li>
            ))}
          </ul>
        )}

        {saveMsg && (
          <p
            className={`text-sm ${saveMsg.ok ? "text-emerald-400" : "text-red-400"}`}
          >
            {saveMsg.text}
          </p>
        )}

        <button
          onClick={onSave}
          disabled={!validation.ok || pending}
          className="rounded-md bg-indigo-600 px-4 py-2.5 font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save squad"}
        </button>
      </aside>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm ${
        active ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}
