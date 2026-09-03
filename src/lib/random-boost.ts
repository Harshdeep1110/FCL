import { prisma } from "@/lib/prisma";
import { RANDOM_BOOST } from "@/lib/config";
import type { Stage } from "@/generated/prisma/enums";

export interface RandomBoostResult {
  gameweek: number;
  selected: number[];
  alreadySelected: boolean;
}

/**
 * Select the gameweek's Random Boost players (PRD §6): after the deadline,
 * pick 5 players from clubs still active in the competition, server-side.
 * Their points get a ×1.5 in resolution. Idempotent — won't reselect.
 */
export async function selectRandomBoost(
  gwNumber: number,
  stage: Stage = "LEAGUE",
  opts: { requireDeadlinePassed?: boolean } = {},
): Promise<RandomBoostResult> {
  const { requireDeadlinePassed = true } = opts;

  const gw = await prisma.gameweek.findUnique({
    where: { number_stage: { number: gwNumber, stage } },
  });
  if (!gw) throw new Error(`Gameweek ${gwNumber} (${stage}) not found.`);

  if (requireDeadlinePassed && gw.deadline.getTime() > Date.now())
    throw new Error("Random Boost can only be selected after the deadline.");

  // Idempotent: if already picked, return the existing selection.
  const existing = await prisma.randomBoostSelection.findMany({
    where: { gameweekId: gw.id },
    select: { playerId: true },
  });
  if (existing.length > 0)
    return {
      gameweek: gwNumber,
      selected: existing.map((e) => e.playerId),
      alreadySelected: true,
    };

  // Eligible: players from non-eliminated clubs.
  const eligible = await prisma.player.findMany({
    where: { club: { eliminated: false } },
    select: { id: true },
  });
  if (eligible.length === 0) throw new Error("No eligible players for Random Boost.");

  // Server-side random sample without replacement.
  const pool = eligible.map((p) => p.id);
  const picks: number[] = [];
  const count = Math.min(RANDOM_BOOST.playersPerGameweek, pool.length);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picks.push(pool[idx]);
    pool.splice(idx, 1);
  }

  await prisma.$transaction([
    prisma.randomBoostSelection.createMany({
      data: picks.map((playerId) => ({ gameweekId: gw.id, playerId })),
    }),
    prisma.playerGameweekPoints.updateMany({
      where: { gameweekId: gw.id, playerId: { in: picks } },
      data: { randomBoosted: true },
    }),
    prisma.gameweek.update({
      where: { id: gw.id },
      data: { randomBoostSelected: true },
    }),
  ]);

  return { gameweek: gwNumber, selected: picks, alreadySelected: false };
}
