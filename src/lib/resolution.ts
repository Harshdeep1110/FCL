import { MULTIPLIERS, CHIP_RULES } from "@/lib/config";

/**
 * Pure gameweek resolution engine (PRD §5, §8 resolve order).
 *
 * Order of operations, exactly per the PRD:
 *   1. Red Card zeroing   — target's base → 0 for every owner, before anything.
 *   2. Captain ×2 / Banker ×2 — buyer/owner-scoped multipliers.
 *   3. Random Boost ×1.5  — applied LAST, to every owner of a boosted player.
 *   4. Bounty payouts     — threshold reads RAW base (pre-multiplier); transfers
 *                           final post-multiplier points; wasted if red-carded.
 *   5. Bench Boost        — bench points count toward the buyer's total.
 *   6. (Free Hit is a lineup-level mechanic, handled at snapshot/revert time.)
 *   7. Transfer penalties — −4 each, subtracted from the gameweek total.
 *
 * Kept pure (in-memory) so the ordering is unit-testable independent of the DB.
 */

export interface PlayerPointInput {
  /** Raw base points from the scoring table (PRD §4). */
  base: number;
  /** One of the 5 Random Boost picks this gameweek. */
  randomBoosted: boolean;
}

export interface LineupEntryInput {
  playerId: number;
  isStarting: boolean;
  isCaptain: boolean;
}

export interface UserLineupInput {
  userId: string;
  entries: LineupEntryInput[];
  /** Buyer played Bench Boost this gameweek. */
  benchBoost: boolean;
  /** playerId this user played Banker on (if any). */
  bankerPlayerId?: number | null;
  /** Total points cost of chips this user bought this gameweek. */
  chipCost: number;
  /** Total transfer penalty points for this user this gameweek (>= 0). */
  transferPenalty: number;
}

export interface BountyInput {
  buyerId: string;
  targetPlayerId: number;
}

export interface ResolveInput {
  players: Map<number, PlayerPointInput>;
  lineups: UserLineupInput[];
  /** Players hit by a Red Card this gameweek. */
  redCardPlayerIds: Set<number>;
  bounties: BountyInput[];
}

export interface PlayerFinal {
  playerId: number;
  isStarting: boolean;
  finalPoints: number;
}

export interface UserScore {
  userId: string;
  startingPoints: number;
  benchPoints: number;
  bountyGained: number;
  bountyLost: number;
  chipCost: number;
  transferPenalty: number;
  total: number;
  playerFinals: PlayerFinal[];
}

export interface BountyTransfer {
  buyerId: string;
  ownerId: string;
  playerId: number;
  points: number;
}

export interface ResolveOutput {
  scores: UserScore[];
  bountyTransfers: BountyTransfer[];
}

/** Effective base after Red Card zeroing (step 1). */
function effectiveBase(playerId: number, input: ResolveInput): number {
  if (input.redCardPlayerIds.has(playerId)) return 0;
  return input.players.get(playerId)?.base ?? 0;
}

/**
 * Final points a given player yields for a given owner, applying that owner's
 * captain/banker (×2, step 2) then Random Boost (×1.5, step 3 — always last).
 */
function finalFor(
  playerId: number,
  entry: LineupEntryInput,
  lineup: UserLineupInput,
  input: ResolveInput,
): number {
  let pts = effectiveBase(playerId, input);
  if (entry.isCaptain) pts *= MULTIPLIERS.captain;
  if (lineup.bankerPlayerId === playerId) pts *= MULTIPLIERS.banker;
  if (input.players.get(playerId)?.randomBoosted) pts *= MULTIPLIERS.randomBoost;
  return pts;
}

export function resolveGameweek(input: ResolveInput): ResolveOutput {
  // Steps 1-3 & 5: per-user player finals + starting/bench sums.
  const scores = new Map<string, UserScore>();
  // Quick lookup: for each player, the per-owner final points (for Bounty).
  const finalByPlayerOwner = new Map<string, number>(); // key `${playerId}:${userId}`

  for (const lineup of input.lineups) {
    const playerFinals: PlayerFinal[] = [];
    let starting = 0;
    let bench = 0;
    for (const entry of lineup.entries) {
      const fp = finalFor(entry.playerId, entry, lineup, input);
      playerFinals.push({
        playerId: entry.playerId,
        isStarting: entry.isStarting,
        finalPoints: fp,
      });
      finalByPlayerOwner.set(`${entry.playerId}:${lineup.userId}`, fp);
      if (entry.isStarting) starting += fp;
      else bench += fp;
    }
    scores.set(lineup.userId, {
      userId: lineup.userId,
      startingPoints: starting,
      benchPoints: bench,
      bountyGained: 0,
      bountyLost: 0,
      chipCost: lineup.chipCost,
      transferPenalty: lineup.transferPenalty,
      total: 0, // filled after bounty
      playerFinals,
    });
  }

  // Step 4: Bounty payouts.
  const bountyTransfers: BountyTransfer[] = [];
  for (const bounty of input.bounties) {
    const target = bounty.targetPlayerId;
    const rawBase = input.players.get(target)?.base ?? 0;

    // Wasted if red-carded (PRD), or if raw base meets the threshold.
    if (input.redCardPlayerIds.has(target)) continue;
    if (rawBase >= CHIP_RULES.bountyThreshold) continue;

    for (const lineup of input.lineups) {
      if (lineup.userId === bounty.buyerId) continue; // exclude buyer's own stake
      const owns = lineup.entries.some((e) => e.playerId === target);
      if (!owns) continue;
      const pts = finalByPlayerOwner.get(`${target}:${lineup.userId}`) ?? 0;
      if (pts === 0) continue;

      bountyTransfers.push({
        buyerId: bounty.buyerId,
        ownerId: lineup.userId,
        playerId: target,
        points: pts,
      });
      scores.get(bounty.buyerId)!.bountyGained += pts;
      scores.get(lineup.userId)!.bountyLost += pts;
    }
  }

  // Totals: starting + (bench if bench boost) + bounty ± − chip cost − penalties.
  for (const lineup of input.lineups) {
    const s = scores.get(lineup.userId)!;
    s.total =
      s.startingPoints +
      (lineup.benchBoost ? s.benchPoints : 0) +
      s.bountyGained -
      s.bountyLost -
      s.chipCost -
      s.transferPenalty;
  }

  return { scores: [...scores.values()], bountyTransfers };
}
