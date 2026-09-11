"use client";

import { useMemo, useState, useTransition } from "react";
import type { Position } from "@/generated/prisma/enums";
import {
  getStat,
  saveStatOverride,
  STAT_FIELDS,
  type StatValues,
} from "@/app/admin/actions";

export interface AdminPlayer {
  id: number;
  name: string;
  position: Position;
  clubName: string;
}

export function AdminPanel({
  gameweeks,
  players,
}: {
  gameweeks: { id: string; label: string }[];
  players: AdminPlayer[];
}) {
  const [gameweekId, setGameweekId] = useState(gameweeks[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [player, setPlayer] = useState<AdminPlayer | null>(null);
  const [values, setValues] = useState<StatValues | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const matches = useMemo(
    () =>
      search
        ? players
            .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
            .slice(0, 15)
        : [],
    [players, search],
  );

  function selectPlayer(p: AdminPlayer) {
    setPlayer(p);
    setSearch("");
    setMsg(null);
    startTransition(async () => {
      const v = await getStat(p.id, gameweekId);
      setValues(v);
    });
  }

  function setField(field: keyof StatValues, raw: string | boolean) {
    setValues((prev) =>
      prev
        ? {
            ...prev,
            [field]: typeof raw === "boolean" ? raw : Math.max(0, Number(raw) || 0),
          }
        : prev,
    );
  }

  function onSave() {
    if (!player || !values) return;
    setMsg(null);
    startTransition(async () => {
      const res = await saveStatOverride({ playerId: player.id, gameweekId, reason, values });
      if (res.ok) {
        setMsg({ ok: true, text: `Saved ${res.changes} change(s); ${res.recomputed} players rescored. Re-run resolve-chips to cascade.` });
        setReason("");
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  return (
    <div className="card-surface rounded-2xl p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted">Gameweek</label>
        <select
          value={gameweekId}
          onChange={(e) => {
            setGameweekId(e.target.value);
            setPlayer(null);
            setValues(null);
          }}
          className="rounded border border-border bg-surface-2 px-3 py-1.5 text-sm"
        >
          {gameweeks.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
      </div>

      {!player && (
        <div className="relative">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a player to edit…"
            className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-ucl-cyan"
          />
          {matches.length > 0 && (
            <ul className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface-2">
              {matches.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => selectPlayer(p)}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-surface-2"
                  >
                    <span>{p.name}</span>
                    <span className="text-xs text-muted">
                      {p.position} · {p.clubName}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {player && values && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="font-medium">
              {player.name}{" "}
              <span className="text-xs text-muted">
                {player.position} · {player.clubName}
              </span>
            </div>
            <button
              onClick={() => {
                setPlayer(null);
                setValues(null);
              }}
              className="text-sm text-muted hover:text-foreground"
            >
              change
            </button>
          </div>

          <label className="mb-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.cleanSheet}
              onChange={(e) => setField("cleanSheet", e.target.checked)}
            />
            Clean sheet
          </label>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {STAT_FIELDS.map((field) => (
              <label key={field} className="flex flex-col gap-1 text-xs">
                <span className="text-muted">{field}</span>
                <input
                  type="number"
                  min={0}
                  value={values[field]}
                  onChange={(e) => setField(field, e.target.value)}
                  className="rounded border border-border bg-surface-2 px-2 py-1.5 text-sm"
                />
              </label>
            ))}
          </div>

          <label className="mt-4 flex flex-col gap-1 text-sm">
            <span className="text-muted">Reason (required, logged)</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. corrected assist per official UEFA stats"
              className="rounded border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-ucl-cyan"
            />
          </label>

          {msg && (
            <p className={`mt-3 text-sm ${msg.ok ? "text-ok" : "text-bad"}`} role="status">
              {msg.text}
            </p>
          )}

          <button
            onClick={onSave}
            disabled={pending || reason.trim().length < 3}
            className="mt-4 rounded-lg bg-gradient-to-r from-ucl-cyan to-ucl-blue px-4 py-2 text-sm font-semibold text-[#04122e] transition hover:brightness-110 disabled:opacity-40 disabled:grayscale"
          >
            {pending ? "Saving…" : "Save override & recompute"}
          </button>
        </div>
      )}
    </div>
  );
}
