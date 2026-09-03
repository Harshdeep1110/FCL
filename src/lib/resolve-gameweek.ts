import { prisma } from "@/lib/prisma";
import { CHIP_COST } from "@/lib/config";
import {
  resolveGameweek,
  type ResolveInput,
  type UserLineupInput,
  type PlayerPointInput,
} from "@/lib/resolution";
import type { Stage } from "@/generated/prisma/enums";

export interface ResolvePersistResult {
  gameweek: number;
  usersScored: number;
  bountyTransfers: number;
}

/**
 * Resolve a gameweek against the database (PRD §8 resolve-chips): reads locked
 * lineups, base points, chips, random boosts and transfer penalties; runs the
 * pure resolution engine; writes LineupPlayer.finalPoints, UserGameweekScore
 * and BountyPayout. Idempotent.
 */
export async function resolveGameweekPersisted(
  gwNumber: number,
  stage: Stage = "LEAGUE",
): Promise<ResolvePersistResult> {
  const gw = await prisma.gameweek.findUnique({
    where: { number_stage: { number: gwNumber, stage } },
  });
  if (!gw) throw new Error(`Gameweek ${gwNumber} (${stage}) not found.`);
  const gameweekId = gw.id;

  const [lineups, points, boosts, chips, transferAgg] = await Promise.all([
    prisma.lineup.findMany({
      where: { gameweekId },
      include: { players: true },
    }),
    prisma.playerGameweekPoints.findMany({ where: { gameweekId } }),
    prisma.randomBoostSelection.findMany({ where: { gameweekId } }),
    prisma.chipPurchase.findMany({ where: { gameweekId } }),
    prisma.transfer.groupBy({
      by: ["userId"],
      where: { gameweekId },
      _sum: { pointsPenalty: true },
    }),
  ]);

  // Player points map (+ random-boost flag).
  const boostedIds = new Set(boosts.map((b) => b.playerId));
  const players = new Map<number, PlayerPointInput>();
  for (const p of points) {
    players.set(p.playerId, {
      base: p.basePoints,
      randomBoosted: boostedIds.has(p.playerId),
    });
  }
  // Ensure every boosted or lineup player has an entry (base 0 if unscored).
  for (const l of lineups)
    for (const lp of l.players)
      if (!players.has(lp.playerId))
        players.set(lp.playerId, {
          base: 0,
          randomBoosted: boostedIds.has(lp.playerId),
        });

  // Chip-derived inputs.
  const redCardPlayerIds = new Set<number>();
  const bankerByUser = new Map<string, number>();
  const benchBoostUsers = new Set<string>();
  const chipCostByUser = new Map<string, number>();
  const bounties: ResolveInput["bounties"] = [];
  for (const c of chips) {
    chipCostByUser.set(
      c.userId,
      (chipCostByUser.get(c.userId) ?? 0) + c.pointsCost,
    );
    if (c.chipType === "RED_CARD" && c.targetPlayerId)
      redCardPlayerIds.add(c.targetPlayerId);
    if (c.chipType === "BANKER" && c.targetPlayerId)
      bankerByUser.set(c.userId, c.targetPlayerId);
    if (c.chipType === "BENCH_BOOST") benchBoostUsers.add(c.userId);
    if (c.chipType === "BOUNTY" && c.targetPlayerId)
      bounties.push({ buyerId: c.userId, targetPlayerId: c.targetPlayerId });
  }

  const penaltyByUser = new Map<string, number>(
    transferAgg.map((t) => [t.userId, Math.abs(t._sum.pointsPenalty ?? 0)]),
  );

  const lineupInputs: UserLineupInput[] = lineups.map((l) => ({
    userId: l.userId,
    entries: l.players.map((p) => ({
      playerId: p.playerId,
      isStarting: p.isStarting,
      isCaptain: p.isCaptain,
    })),
    benchBoost: benchBoostUsers.has(l.userId),
    bankerPlayerId: bankerByUser.get(l.userId) ?? null,
    chipCost: chipCostByUser.get(l.userId) ?? 0,
    transferPenalty: penaltyByUser.get(l.userId) ?? 0,
  }));

  const output = resolveGameweek({
    players,
    lineups: lineupInputs,
    redCardPlayerIds,
    bounties,
  });

  // --- Persist -------------------------------------------------------------
  const lineupByUser = new Map(lineups.map((l) => [l.userId, l]));

  await prisma.$transaction(async (tx) => {
    // LineupPlayer.finalPoints.
    for (const s of output.scores) {
      const lineup = lineupByUser.get(s.userId);
      if (!lineup) continue;
      const lpByPlayer = new Map(lineup.players.map((p) => [p.playerId, p.id]));
      for (const pf of s.playerFinals) {
        const lpId = lpByPlayer.get(pf.playerId);
        if (lpId)
          await tx.lineupPlayer.update({
            where: { id: lpId },
            data: { finalPoints: pf.finalPoints },
          });
      }
      await tx.userGameweekScore.upsert({
        where: { userId_gameweekId: { userId: s.userId, gameweekId } },
        create: {
          userId: s.userId,
          gameweekId,
          startingPoints: s.startingPoints,
          benchPoints: s.benchPoints,
          chipCost: s.chipCost,
          bountyGained: s.bountyGained,
          bountyLost: s.bountyLost,
          transferPenalty: s.transferPenalty,
          total: s.total,
        },
        update: {
          startingPoints: s.startingPoints,
          benchPoints: s.benchPoints,
          chipCost: s.chipCost,
          bountyGained: s.bountyGained,
          bountyLost: s.bountyLost,
          transferPenalty: s.transferPenalty,
          total: s.total,
        },
      });
    }

    // Bounty payouts (replace).
    await tx.bountyPayout.deleteMany({ where: { gameweekId } });
    if (output.bountyTransfers.length > 0)
      await tx.bountyPayout.createMany({
        data: output.bountyTransfers.map((b) => ({
          gameweekId,
          buyerId: b.buyerId,
          ownerId: b.ownerId,
          playerId: b.playerId,
          points: b.points,
        })),
      });

    // Mark chips resolved; record bounty winnings on the buyer's bounty chip.
    const gainByUser = new Map(
      output.scores.map((s) => [s.userId, s.bountyGained]),
    );
    for (const c of chips) {
      await tx.chipPurchase.update({
        where: { id: c.id },
        data: {
          resolved: true,
          resultPoints:
            c.chipType === "BOUNTY" ? (gainByUser.get(c.userId) ?? 0) : null,
        },
      });
    }

    await tx.gameweek.update({
      where: { id: gameweekId },
      data: { chipsResolved: true },
    });
  });

  return {
    gameweek: gwNumber,
    usersScored: output.scores.length,
    bountyTransfers: output.bountyTransfers.length,
  };
}

/** Chip point cost for a given purchase (0 if it's the user's free chip). */
export function chipCost(chipType: keyof typeof CHIP_COST, isFree: boolean) {
  return isFree ? 0 : CHIP_COST[chipType];
}
