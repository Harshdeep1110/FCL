/**
 * Central tunable constants for the UCL Fantasy League.
 *
 * Everything here maps directly to the PRD (ucl-fantasy-prd.md). These live in
 * code (not the DB) so they can be adjusted and redeployed without a migration.
 * The PRD explicitly flags several of these as "tune after a few live gameweeks"
 * (chip prices, pricing coefficients) — change them here.
 */

import type { ChipType, Position, SquadStage } from "@/generated/prisma/enums";

// ---------------------------------------------------------------------------
// Squad composition (PRD §3.2)
// ---------------------------------------------------------------------------

export interface SquadRules {
  budget: number;
  squadSize: number;
  /** Required count per position across the full squad. */
  positionCounts: Record<Position, number>;
  /** Max players allowed from a single club. */
  maxPerClub: number;
  startingSize: number;
  benchSize: number;
  /** Allowed range of starters per position in the starting lineup. */
  startingBounds: Record<Position, { min: number; max: number }>;
}

export const SQUAD_RULES: Record<SquadStage, SquadRules> = {
  LEAGUE: {
    budget: 100,
    squadSize: 15,
    positionCounts: { GK: 2, DEF: 5, MID: 5, ATT: 3 },
    maxPerClub: 3,
    startingSize: 11,
    benchSize: 4,
    startingBounds: {
      GK: { min: 1, max: 1 },
      DEF: { min: 3, max: 5 },
      MID: { min: 3, max: 5 },
      ATT: { min: 1, max: 3 },
    },
  },
  // Knockout redraft (PRD §3.2 / §7): hard reset to 50M, 7 players, start 5
  // (exactly 1 GK + any 4 of the other 6 — no sub-position minimums).
  // 3-per-club cap assumed to carry over (PRD open item #3).
  KNOCKOUT: {
    budget: 50,
    squadSize: 7,
    positionCounts: { GK: 1, DEF: 2, MID: 2, ATT: 2 },
    maxPerClub: 3,
    startingSize: 5,
    benchSize: 2,
    startingBounds: {
      GK: { min: 1, max: 1 },
      DEF: { min: 0, max: 2 },
      MID: { min: 0, max: 2 },
      ATT: { min: 0, max: 2 },
    },
  },
};

// ---------------------------------------------------------------------------
// Scoring table (PRD §4)
// ---------------------------------------------------------------------------

export const SCORING = {
  appearance: { short: 1, long: 2 }, // 1–59 mins vs 60+ (incl. extra time)
  longPlayThreshold: 60,
  goal: { GK: 6, DEF: 6, MID: 5, ATT: 4 } as Record<Position, number>,
  assist: 3,
  cleanSheet: { GK: 4, DEF: 4, MID: 1, ATT: 0 } as Record<Position, number>,
  savesPerPoint: 3, // every 3 saves → 1 pt (GK only)
  penaltySave: 5,
  penaltyMiss: -2,
  goalsConcededPerNegPoint: 2, // every 2 conceded → −1 (GK/DEF only)
  yellowCard: -1,
  redCard: -3,
  ownGoal: -2,
  defensiveContribution: 2, // capped, one-time per match, if threshold met
} as const;

/** CBIT thresholds for the "defensive contribution" bonus (PRD §4).
 *  Used by the API-Football path (which exposes raw CBIT). */
export const DEFENSIVE_CONTRIBUTION_THRESHOLD: Record<Position, number> = {
  GK: Infinity, // n/a
  DEF: 10, // 10+ CBIT
  MID: 12, // 12+ CBIT + recoveries
  ATT: 12,
};

/** Adapted defensive-contribution thresholds for the UEFA path, which exposes
 *  "balls recovered" (bR) rather than raw CBIT (product decision — tune here).
 *  bR is recoveries-only (a subset of CBIT), so thresholds are lower. */
export const DEFENSIVE_CONTRIBUTION_BR_THRESHOLD: Record<Position, number> = {
  GK: Infinity, // n/a
  DEF: 6,
  MID: 8,
  ATT: 8,
};

// ---------------------------------------------------------------------------
// Multipliers & order of operations (PRD §5)
// ---------------------------------------------------------------------------

export const MULTIPLIERS = {
  captain: 2,
  banker: 2,
  randomBoost: 1.5, // always applied LAST (PRD §5 / §6)
} as const;

// ---------------------------------------------------------------------------
// Chips (PRD §5, §5a)
// ---------------------------------------------------------------------------

/** Point cost of buying each chip (the first chip per user is always free). */
export const CHIP_COST: Record<ChipType, number> = {
  INFLATION: 7,
  BOUNTY: 9,
  BENCH_BOOST: 11,
  BANKER: 14,
  RED_CARD: 15,
  FREE_HIT: 20,
};

export const CHIP_RULES = {
  freeChipsPerUser: 1,
  maxChipsPerGameweek: 2,
  bountyThreshold: 4, // triggers only if target base points < 4
  inflationPct: 0.1, // +10% to target club's player prices
} as const;

/** Which chips target a single player vs. a club vs. nothing. */
export const CHIP_TARGET: Record<ChipType, "PLAYER" | "CLUB" | "NONE"> = {
  RED_CARD: "PLAYER",
  BANKER: "PLAYER",
  BOUNTY: "PLAYER",
  INFLATION: "CLUB",
  BENCH_BOOST: "NONE",
  FREE_HIT: "NONE",
};

// ---------------------------------------------------------------------------
// Random Boost (PRD §6)
// ---------------------------------------------------------------------------

export const RANDOM_BOOST = {
  playersPerGameweek: 5,
  multiplier: MULTIPLIERS.randomBoost,
} as const;

// ---------------------------------------------------------------------------
// Transfers (PRD §3.3)
// ---------------------------------------------------------------------------

export const TRANSFERS = {
  freePerGameweek: 1,
  maxBank: 3,
  extraTransferPenalty: -4,
} as const;

// ---------------------------------------------------------------------------
// Deadlines (PRD §3.1 / §7)
// ---------------------------------------------------------------------------

export const DEADLINE_OFFSET_MINUTES = 60; // deadline = earliest kickoff − 1hr

// ---------------------------------------------------------------------------
// Pricing algorithm (PRD §9) — STARTING values, tune via simulation
// ---------------------------------------------------------------------------

export const PRICING = {
  /** β: expected points per unit price. Position-differentiated. */
  beta: { GK: 0.6, DEF: 0.6, MID: 0.75, ATT: 0.8 } as Record<Position, number>,
  lambda: 0.45, // EMA smoothing factor
  gamma: 0.05, // delta → price scaling
  maxMovePct: 0.05, // max ±5% of current price per gameweek
  floorPct: 0.6, // price floor = 60% of original
  ceilingPct: 1.8, // price ceiling = 180% of original
} as const;

// ---------------------------------------------------------------------------
// API-Football budget discipline (PRD §8, §10)
// ---------------------------------------------------------------------------

export const API_FOOTBALL = {
  dailyLimit: 100,
  /** Stop making calls once this many have been used today (safety margin). */
  dailySafetyCap: 90,
  perMinuteLimit: 10,
  quotaResetTimezone: "UTC", // quota resets 00:00 UTC
} as const;

// ---------------------------------------------------------------------------
// UEFA fantasy feeds (primary source for the current season — §8a).
// Free, current-season, includes prices. Unofficial/undocumented.
// ---------------------------------------------------------------------------

export const UEFA = {
  baseUrl: "https://gaming.uefa.com/en/uclfantasy/services/feeds",
  /** Feed id for the current season (90 = 2026/27). Override via env. */
  feedId: Number(process.env.UEFA_FEED_ID ?? 90),
  /** Feed timestamps are European (CET/CEST); parse in this zone, store UTC. */
  timezone: "Europe/Zurich",
  /** UEFA `skill` code → our Position. */
  positionBySkill: { 1: "GK", 2: "DEF", 3: "MID", 4: "ATT" } as Record<
    number,
    Position
  >,
} as const;
