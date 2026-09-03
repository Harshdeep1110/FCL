import type { Position, SquadStage } from "@/generated/prisma/enums";
import { SQUAD_RULES } from "@/lib/config";

/** Minimal player shape needed to validate a squad selection. */
export interface DraftEntry {
  playerId: number;
  position: Position;
  price: number;
  clubId: string;
  isStarting: boolean;
  isCaptain: boolean;
}

export interface SquadSummary {
  totalPlayers: number;
  startingCount: number;
  benchCount: number;
  budget: number;
  budgetSpent: number;
  budgetRemaining: number;
  positionCounts: Record<Position, number>;
  startingByPosition: Record<Position, number>;
  perClubCounts: Record<string, number>;
  captainId: number | null;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  summary: SquadSummary;
}

const POSITIONS: Position[] = ["GK", "DEF", "MID", "ATT"];

function emptyPositionRecord(): Record<Position, number> {
  return { GK: 0, DEF: 0, MID: 0, ATT: 0 };
}

/** Round to cents to avoid float drift when summing prices. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function summarize(
  entries: DraftEntry[],
  stage: SquadStage,
): SquadSummary {
  const rules = SQUAD_RULES[stage];
  const positionCounts = emptyPositionRecord();
  const startingByPosition = emptyPositionRecord();
  const perClubCounts: Record<string, number> = {};
  let budgetSpent = 0;
  let startingCount = 0;
  let captainId: number | null = null;

  for (const e of entries) {
    positionCounts[e.position] += 1;
    perClubCounts[e.clubId] = (perClubCounts[e.clubId] ?? 0) + 1;
    budgetSpent += e.price;
    if (e.isStarting) {
      startingCount += 1;
      startingByPosition[e.position] += 1;
    }
    if (e.isCaptain) captainId = e.playerId;
  }

  budgetSpent = round2(budgetSpent);

  return {
    totalPlayers: entries.length,
    startingCount,
    benchCount: entries.length - startingCount,
    budget: rules.budget,
    budgetSpent,
    budgetRemaining: round2(rules.budget - budgetSpent),
    positionCounts,
    startingByPosition,
    perClubCounts,
    captainId,
  };
}

/**
 * Validate a squad selection against the composition + lineup rules for a
 * stage (PRD §3.2). Returns every violation so the UI can surface them all.
 */
export function validateSquad(
  entries: DraftEntry[],
  stage: SquadStage,
): ValidationResult {
  const rules = SQUAD_RULES[stage];
  const summary = summarize(entries, stage);
  const errors: string[] = [];

  // No duplicate players.
  const uniqueIds = new Set(entries.map((e) => e.playerId));
  if (uniqueIds.size !== entries.length) {
    errors.push("Duplicate players in squad.");
  }

  // Total squad size.
  if (entries.length !== rules.squadSize) {
    errors.push(
      `Squad must have exactly ${rules.squadSize} players (has ${entries.length}).`,
    );
  }

  // Exact position counts across the full squad.
  for (const pos of POSITIONS) {
    const need = rules.positionCounts[pos];
    const have = summary.positionCounts[pos];
    if (have !== need) {
      errors.push(`Need exactly ${need} ${pos} (has ${have}).`);
    }
  }

  // Budget.
  if (summary.budgetSpent > rules.budget) {
    errors.push(
      `Over budget: ${summary.budgetSpent.toFixed(1)}M spent of ${rules.budget}M.`,
    );
  }

  // Max players per club.
  for (const [clubId, count] of Object.entries(summary.perClubCounts)) {
    if (count > rules.maxPerClub) {
      errors.push(
        `Max ${rules.maxPerClub} players from one club (club ${clubId} has ${count}).`,
      );
    }
  }

  // Starting lineup size.
  if (summary.startingCount !== rules.startingSize) {
    errors.push(
      `Starting lineup must have exactly ${rules.startingSize} players (has ${summary.startingCount}).`,
    );
  }

  // Starting lineup per-position bounds.
  for (const pos of POSITIONS) {
    const bound = rules.startingBounds[pos];
    const have = summary.startingByPosition[pos];
    if (have < bound.min || have > bound.max) {
      const range = bound.min === bound.max ? `${bound.min}` : `${bound.min}–${bound.max}`;
      errors.push(`Starting lineup needs ${range} ${pos} (has ${have}).`);
    }
  }

  // Exactly one captain, who must be starting.
  const captains = entries.filter((e) => e.isCaptain);
  if (captains.length === 0) {
    errors.push("You must pick a captain.");
  } else if (captains.length > 1) {
    errors.push("Only one captain allowed.");
  } else if (!captains[0].isStarting) {
    errors.push("Captain must be in the starting lineup.");
  }

  return { ok: errors.length === 0, errors, summary };
}
