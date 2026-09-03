import type { Position } from "@/generated/prisma/enums";
import {
  SCORING,
  DEFENSIVE_CONTRIBUTION_BR_THRESHOLD,
  DEFENSIVE_CONTRIBUTION_THRESHOLD,
} from "@/lib/config";

/**
 * Raw per-player, per-gameweek stat line consumed by the scoring engine.
 * Mirrors PlayerGameweekStat. Extra-time minutes count toward appearance
 * tiers (PRD §4), so they're summed into effective minutes.
 */
export interface ScoringStat {
  position: Position;
  minutesPlayed: number;
  minutesExtraTime?: number;
  goals?: number;
  assists?: number;
  cleanSheet?: boolean;
  goalsConceded?: number;
  saves?: number;
  penaltiesSaved?: number;
  penaltiesMissed?: number;
  yellowCards?: number;
  redCards?: number;
  ownGoals?: number;
  /** UEFA path (primary). */
  ballsRecovered?: number;
  /** API-Football path (alternate). */
  cbitCount?: number;
}

export interface ScoreBreakdown {
  appearance: number;
  goals: number;
  assists: number;
  cleanSheet: number;
  saves: number;
  penaltySaves: number;
  penaltyMisses: number;
  goalsConceded: number;
  cards: number;
  ownGoals: number;
  defensiveContribution: number;
}

export interface ScoreResult {
  total: number;
  breakdown: ScoreBreakdown;
}

/**
 * Whether the defensive-contribution bonus is met. Prefers UEFA "balls
 * recovered" (primary source); falls back to raw CBIT for the API-Football
 * path. GK never qualifies.
 */
export function meetsDefensiveContribution(s: ScoringStat): boolean {
  if (s.position === "GK") return false;
  if (s.ballsRecovered != null) {
    return s.ballsRecovered >= DEFENSIVE_CONTRIBUTION_BR_THRESHOLD[s.position];
  }
  if (s.cbitCount != null) {
    return s.cbitCount >= DEFENSIVE_CONTRIBUTION_THRESHOLD[s.position];
  }
  return false;
}

/**
 * Compute a player's BASE fantasy points for one gameweek (PRD §4), before any
 * multiplier (captain/Banker/Random Boost). This is the value Bounty's `< 4`
 * threshold reads. Pure and deterministic.
 */
export function computeBasePoints(s: ScoringStat): ScoreResult {
  const pos = s.position;
  const minutes = (s.minutesPlayed ?? 0) + (s.minutesExtraTime ?? 0);
  const goals = s.goals ?? 0;
  const assists = s.assists ?? 0;
  const saves = s.saves ?? 0;
  const conceded = s.goalsConceded ?? 0;

  const appearance =
    minutes >= SCORING.longPlayThreshold
      ? SCORING.appearance.long
      : minutes > 0
        ? SCORING.appearance.short
        : 0;

  const goalPts = goals * SCORING.goal[pos];
  const assistPts = assists * SCORING.assist;
  const cleanSheetPts = s.cleanSheet ? SCORING.cleanSheet[pos] : 0;

  // Saves: every 3 saves → 1 point, GK only.
  const savePts =
    pos === "GK" ? Math.floor(saves / SCORING.savesPerPoint) : 0;

  const penaltySavePts = (s.penaltiesSaved ?? 0) * SCORING.penaltySave;
  const penaltyMissPts = (s.penaltiesMissed ?? 0) * SCORING.penaltyMiss;

  // Goals conceded: every 2 → −1, GK/DEF only.
  const concededPts =
    pos === "GK" || pos === "DEF"
      ? -Math.floor(conceded / SCORING.goalsConcededPerNegPoint)
      : 0;

  const cardPts =
    (s.yellowCards ?? 0) * SCORING.yellowCard +
    (s.redCards ?? 0) * SCORING.redCard;
  const ownGoalPts = (s.ownGoals ?? 0) * SCORING.ownGoal;

  const defensivePts = meetsDefensiveContribution(s)
    ? SCORING.defensiveContribution
    : 0;

  const breakdown: ScoreBreakdown = {
    appearance,
    goals: goalPts,
    assists: assistPts,
    cleanSheet: cleanSheetPts,
    saves: savePts,
    penaltySaves: penaltySavePts,
    penaltyMisses: penaltyMissPts,
    goalsConceded: concededPts,
    cards: cardPts,
    ownGoals: ownGoalPts,
    defensiveContribution: defensivePts,
  };

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { total, breakdown };
}
