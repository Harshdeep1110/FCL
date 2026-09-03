import { prisma } from "@/lib/prisma";
import type { Stage, SquadStage } from "@/generated/prisma/enums";

/** Which squad a gameweek's lineups come from. */
export function squadStageFor(stage: Stage): SquadStage {
  return stage === "LEAGUE" ? "LEAGUE" : "KNOCKOUT";
}

export interface LockResult {
  gameweek: number;
  lineupsLocked: number;
}

/**
 * Lock a gameweek: snapshot every user's live roster (SquadPlayer) into a
 * per-gameweek Lineup/LineupPlayer, the source of truth for scoring. Runs at
 * the deadline. Idempotent — re-locking refreshes the snapshot.
 */
export async function lockGameweek(
  gwNumber: number,
  stage: Stage = "LEAGUE",
): Promise<LockResult> {
  const gw = await prisma.gameweek.findUnique({
    where: { number_stage: { number: gwNumber, stage } },
  });
  if (!gw) throw new Error(`Gameweek ${gwNumber} (${stage}) not found.`);

  const squadStage = squadStageFor(stage);
  const squads = await prisma.squad.findMany({
    where: { stage: squadStage },
    include: {
      players: {
        include: { player: { select: { position: true } } },
      },
    },
  });

  let locked = 0;
  for (const squad of squads) {
    if (squad.players.length === 0) continue;

    const lineup = await prisma.lineup.upsert({
      where: { userId_gameweekId: { userId: squad.userId, gameweekId: gw.id } },
      create: { userId: squad.userId, gameweekId: gw.id, stage: squadStage },
      update: {},
    });

    await prisma.$transaction([
      prisma.lineupPlayer.deleteMany({ where: { lineupId: lineup.id } }),
      prisma.lineupPlayer.createMany({
        data: squad.players.map((sp) => ({
          lineupId: lineup.id,
          playerId: sp.playerId,
          position: sp.player.position,
          isStarting: sp.isStarting,
          isCaptain: sp.isCaptain,
        })),
      }),
    ]);
    locked += 1;
  }

  await prisma.gameweek.update({
    where: { id: gw.id },
    data: { locked: true },
  });

  return { gameweek: gwNumber, lineupsLocked: locked };
}
