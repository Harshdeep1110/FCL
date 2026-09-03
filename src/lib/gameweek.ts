import { prisma } from "@/lib/prisma";
import type { Stage } from "@/generated/prisma/enums";

/**
 * The gameweek currently being played/scored: the latest one whose deadline has
 * passed. Used by the cron orchestrator, which can't receive a ?gw param.
 */
export async function currentGameweek(stage: Stage = "LEAGUE") {
  return prisma.gameweek.findFirst({
    where: { stage, deadline: { lte: new Date() } },
    orderBy: { deadline: "desc" },
  });
}

/** Whether every fixture in a gameweek has finished (safe to finalize prices). */
export async function allFixturesFinished(gameweekId: string): Promise<boolean> {
  const total = await prisma.fixture.count({ where: { gameweekId } });
  if (total === 0) return false;
  const finished = await prisma.fixture.count({
    where: { gameweekId, status: "FINISHED" },
  });
  return finished === total;
}
