"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Position, SquadStage } from "@/generated/prisma/enums";
import { SQUAD_RULES } from "@/lib/config";
import {
  summarize,
  validateSquad,
  type DraftEntry,
} from "@/lib/squad-validation";
import { saveDraft } from "@/app/draft/actions";
import { Pitch, type PitchSlot } from "@/components/ui/Pitch";
import { AnimatedNumber } from "@/components/ui/motion";

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
// Pitch rows are rendered attackers-first (top) down to the keeper (bottom).
const ROW_ORDER: Position[] = ["ATT", "MID", "DEF", "GK"];

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

  // UI overlays: the player picker (opened from an empty slot / "add") and the
  // per-player action sheet (opened by tapping a shirt on the pitch).
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activePlayerId, setActivePlayerId] = useState<number | null>(null);

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

  // Close overlays with Escape.
  useEffect(() => {
    if (!pickerOpen && activePlayerId === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPickerOpen(false);
        setActivePlayerId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickerOpen, activePlayerId]);

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

  function openPicker(pos: Position) {
    setPosFilter(pos);
    setSearch("");
    setPickerOpen(true);
  }

  // -- Build the pitch slots (starters in formation rows + bench) ----------
  const { rows, bench } = useMemo(
    () => buildSlots(entries, poolById, summary, rules),
    [entries, poolById, summary, rules],
  );

  const activePlayer =
    activePlayerId !== null
      ? entries.find((e) => e.playerId === activePlayerId)
      : undefined;

  const filteredPool = pool.filter((p) => {
    if (posFilter !== "ALL" && p.position !== posFilter) return false;
    if (clubFilter !== "ALL" && p.clubId !== clubFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  const overBudget = summary.budgetRemaining < 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-32 pt-4 sm:px-6">
      {/* Summary bar */}
      <div className="card-surface mb-4 rounded-2xl p-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted">
              Budget remaining
            </div>
            <div
              className={`font-mono text-3xl font-bold ${overBudget ? "text-bad" : "text-ok"}`}
            >
              <AnimatedNumber
                value={summary.budgetRemaining}
                decimals={1}
                suffix="M"
              />
            </div>
          </div>
          <div className="text-right text-xs text-muted">
            <div>
              Squad{" "}
              <span className="font-mono text-foreground">
                {summary.totalPlayers}/{rules.squadSize}
              </span>
            </div>
            <div>
              Starting XI{" "}
              <span className="font-mono text-foreground">
                {summary.startingCount}/{rules.startingSize}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
          {POSITIONS.map((pos) => {
            const have = summary.positionCounts[pos];
            const need = rules.positionCounts[pos];
            const done = have === need;
            return (
              <div
                key={pos}
                className={`rounded-lg border py-1.5 transition-colors ${
                  done
                    ? "border-ok/40 bg-ok/10 text-ok"
                    : "border-border bg-surface-2 text-muted"
                }`}
              >
                <div className="font-semibold">{pos}</div>
                <div className="font-mono text-foreground">
                  {have}/{need}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pitch */}
      <Pitch
        rows={rows}
        bench={bench}
        onSlotClick={openPicker}
        onPlayerClick={(id) => setActivePlayerId(id)}
      />

      {/* Validation hints */}
      <AnimatePresence>
        {!validation.ok && summary.totalPlayers > 0 && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 overflow-hidden rounded-xl border border-warn/30 bg-warn/10 p-3 text-xs text-warn"
          >
            {validation.errors.map((err, i) => (
              <li key={i}>• {err}</li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <AnimatePresence mode="wait">
            {saveMsg ? (
              <motion.p
                key={saveMsg.text}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className={`text-sm ${saveMsg.ok ? "text-ok" : "text-bad"}`}
                role="status"
              >
                {saveMsg.text}
              </motion.p>
            ) : (
              <button
                type="button"
                onClick={() => openPicker(posFilter === "ALL" ? "GK" : posFilter)}
                className="text-sm text-ucl-cyan hover:underline"
              >
                + Add players
              </button>
            )}
          </AnimatePresence>
          <motion.button
            whileTap={validation.ok && !pending ? { scale: 0.96 } : undefined}
            onClick={onSave}
            disabled={!validation.ok || pending}
            className="rounded-xl bg-gradient-to-r from-ucl-cyan to-ucl-blue px-6 py-2.5 font-semibold text-[#04122e] shadow-lg shadow-ucl-blue/25 transition disabled:opacity-40 disabled:shadow-none"
          >
            {pending ? "Saving…" : "Save squad"}
          </motion.button>
        </div>
      </div>

      {/* Player picker */}
      <AnimatePresence>
        {pickerOpen && (
          <Modal onClose={() => setPickerOpen(false)} title="Add a player">
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
                aria-label="Filter by club"
                className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm"
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
                aria-label="Search player"
                className="flex-1 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-ucl-cyan"
              />
            </div>

            <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-2 text-left text-muted">
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
                        className="border-t border-border transition-colors hover:bg-surface-2/60"
                      >
                        <td className="px-3 py-2 font-medium">{p.name}</td>
                        <td className="px-3 py-2 text-muted">{p.clubName}</td>
                        <td className="px-3 py-2 text-muted">{p.position}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {p.price.toFixed(1)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => toggleSelect(p)}
                            disabled={blocked}
                            className={`rounded px-2 py-1 text-xs font-semibold transition ${
                              selected
                                ? "bg-bad/80 hover:bg-bad"
                                : blocked
                                  ? "cursor-not-allowed bg-surface-2 text-muted/50"
                                  : "bg-ucl-blue hover:bg-ucl-cyan hover:text-[#04122e]"
                            }`}
                          >
                            {selected ? "Remove" : "Add"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPool.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-muted">
                        No players match those filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => setPickerOpen(false)}
                className="rounded-lg bg-ucl-blue px-5 py-2 text-sm font-semibold text-white hover:bg-ucl-cyan hover:text-[#04122e]"
              >
                Done
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Per-player action sheet */}
      <AnimatePresence>
        {activePlayer && (
          <Modal
            onClose={() => setActivePlayerId(null)}
            title={poolById.get(activePlayer.playerId)!.name}
            subtitle={`${poolById.get(activePlayer.playerId)!.clubName} · ${activePlayer.position} · ${activePlayer.price.toFixed(1)}M`}
            compact
          >
            <div className="flex flex-col gap-2">
              <ActionButton
                disabled={!activePlayer.isStarting || activePlayer.isCaptain}
                onClick={() => {
                  setCaptain(activePlayer.playerId);
                  setActivePlayerId(null);
                }}
              >
                {activePlayer.isCaptain ? "★ Captain" : "Make captain (×2)"}
              </ActionButton>
              <ActionButton
                onClick={() => {
                  setStarting(activePlayer.playerId, !activePlayer.isStarting);
                  setActivePlayerId(null);
                }}
              >
                {activePlayer.isStarting ? "Move to bench" : "Move to starting XI"}
              </ActionButton>
              <ActionButton
                danger
                onClick={() => {
                  toggleSelect(poolById.get(activePlayer.playerId)!);
                  setActivePlayerId(null);
                }}
              >
                Remove from squad
              </ActionButton>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slot builder — turns the current selection into pitch rows + bench slots,
// padding with empty "+ add" placeholders up to the squad's shape.
// ---------------------------------------------------------------------------
function buildSlots(
  entries: DraftEntry[],
  poolById: Map<number, PoolPlayer>,
  summary: ReturnType<typeof summarize>,
  rules: (typeof SQUAD_RULES)[SquadStage],
): { rows: PitchSlot[][]; bench: PitchSlot[] } {
  const toSlot = (e: DraftEntry): PitchSlot => {
    const p = poolById.get(e.playerId)!;
    return {
      key: `p-${e.playerId}`,
      position: e.position,
      player: {
        id: e.playerId,
        name: p.name,
        subtitle: p.clubName,
        position: e.position,
        value: p.price.toFixed(1),
        isCaptain: e.isCaptain,
      },
    };
  };
  const empty = (pos: Position, key: string): PitchSlot => ({ key, position: pos });

  const startingEmpties = Math.max(0, rules.startingSize - summary.startingCount);
  const benchEmpties = Math.max(0, rules.benchSize - summary.benchCount);
  const remaining: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
  for (const pos of POSITIONS) {
    remaining[pos] = Math.max(
      0,
      rules.positionCounts[pos] - summary.positionCounts[pos],
    );
  }

  // Allocate empty starting slots per position (priority GK→ATT), capped by
  // both remaining squad need and free room in the lineup for that position.
  const pitchEmpty: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
  let startLeft = startingEmpties;
  for (const pos of POSITIONS) {
    const room = rules.startingBounds[pos].max - summary.startingByPosition[pos];
    const take = Math.max(0, Math.min(startLeft, remaining[pos], room));
    pitchEmpty[pos] = take;
    startLeft -= take;
    remaining[pos] -= take;
  }

  // Whatever squad need is left becomes bench placeholders.
  const benchEmptyList: Position[] = [];
  for (const pos of POSITIONS) {
    while (remaining[pos] > 0 && benchEmptyList.length < benchEmpties) {
      benchEmptyList.push(pos);
      remaining[pos]--;
    }
  }
  while (benchEmptyList.length < benchEmpties) benchEmptyList.push("MID");

  const rows: PitchSlot[][] = [];
  for (const pos of ROW_ORDER) {
    const starters = entries
      .filter((e) => e.isStarting && e.position === pos)
      .map(toSlot);
    const empties = Array.from({ length: pitchEmpty[pos] }, (_, i) =>
      empty(pos, `pe-${pos}-${i}`),
    );
    const row = [...starters, ...empties];
    if (row.length > 0) rows.push(row);
  }

  const bench: PitchSlot[] = [
    ...entries.filter((e) => !e.isStarting).map(toSlot),
    ...benchEmptyList.map((pos, i) => empty(pos, `be-${pos}-${i}`)),
  ];

  return { rows, bench };
}

// ---------------------------------------------------------------------------
// Presentational helpers
// ---------------------------------------------------------------------------
function Modal({
  children,
  onClose,
  title,
  subtitle,
  compact,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  subtitle?: string;
  compact?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0.5 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0.5 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className={`card-surface w-full rounded-t-2xl p-4 sm:rounded-2xl ${
          compact ? "sm:max-w-sm" : "sm:max-w-2xl"
        }`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted hover:border-ucl-cyan hover:text-ucl-cyan"
          >
            ✕
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-40 ${
        danger
          ? "bg-bad/15 text-bad hover:bg-bad/25"
          : "bg-surface-2 hover:bg-ucl-blue/20"
      }`}
    >
      {children}
    </button>
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
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-ucl-blue text-white"
          : "bg-surface-2 text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
