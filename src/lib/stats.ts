import { prisma } from "@/lib/prisma";
import { fetchPlayers, type UefaPlayer } from "@/lib/uefa";
import { computeBasePoints } from "@/lib/scoring";
import type { Position } from "@/generated/prisma/enums";

/**
 * Per-gameweek stat line derived by diffing two cumulative UEFA player feeds.
 * UEFA publishes season-cumulative stats per matchday snapshot
 * (players_<feed>_en_<md>.json), so matchday stats = feed(md) − feed(md-1).
 */
export interface MatchdayDelta {
  minutesPlayed: number;
  goals: number;
  assists: number;
  cleanSheet: boolean;
  goalsConceded: number;
  saves: number;
  penaltiesSaved: number;
  penaltiesMissed: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  ballsRecovered: number;
}

/** Pure diff of a player's cumulative stats between matchdays (prev may be null for MD1). */
export function matchdayDelta(
  now: UefaPlayer,
  prev: UefaPlayer | null,
): MatchdayDelta {
  const d = (a: number, b: number) => Math.max(0, (a ?? 0) - (b ?? 0));
  const p: Partial<UefaPlayer> = prev ?? {};
  return {
    minutesPlayed: d(now.minsPlyd, p.minsPlyd ?? 0),
    goals: d(now.gS, p.gS ?? 0),
    assists: d(now.assist, p.assist ?? 0),
    cleanSheet: d(now.cS, p.cS ?? 0) > 0,
    goalsConceded: d(now.gC, p.gC ?? 0),
    saves: d(now.saves, p.saves ?? 0),
    penaltiesSaved: d(now.pS, p.pS ?? 0),
    penaltiesMissed: d(now.pM, p.pM ?? 0),
    yellowCards: d(now.yC, p.yC ?? 0),
    redCards: d(now.rC, p.rC ?? 0),
    ownGoals: d(now.oG, p.oG ?? 0),
    ballsRecovered: d(now.bR, p.bR ?? 0),
  };
}

export interface StatsIngestResult {
  gameweek: number;
  playersFeatured: number;
}

/**
 * Ingest per-player stats for a league gameweek from UEFA feeds (idempotent).
 * Only players who featured (minutes > 0 that GW) get a stat row.
 */
export async function ingestGameweekStats(
  gwNumber: number,
): Promise<StatsIngestResult> {
  const gw = await prisma.gameweek.findUnique({
    where: { number_stage: { number: gwNumber, stage: "LEAGUE" } },
  });
  if (!gw) throw new Error(`Gameweek ${gwNumber} (LEAGUE) not found.`);

  const [now, prev] = await Promise.all([
    fetchPlayers(gwNumber),
    gwNumber > 1 ? fetchPlayers(gwNumber - 1) : Promise.resolve(null),
  ]);
  const prevById = new Map((prev ?? []).map((p) => [p.id, p]));

  // Map UEFA player id → our Player id, for players we track.
  const dbPlayers = await prisma.player.findMany({
    where: { uefaPlayerId: { not: null } },
    select: { id: true, uefaPlayerId: true },
  });
  const dbByUefaId = new Map(dbPlayers.map((p) => [p.uefaPlayerId!, p.id]));

  let featured = 0;
  for (const cur of now) {
    const playerId = dbByUefaId.get(cur.id);
    if (!playerId) continue;
    const delta = matchdayDelta(cur, prevById.get(cur.id) ?? null);
    if (delta.minutesPlayed <= 0) continue; // didn't feature this GW

    await prisma.playerGameweekStat.upsert({
      where: { playerId_gameweekId: { playerId, gameweekId: gw.id } },
      create: { playerId, gameweekId: gw.id, ...delta },
      update: { ...delta },
    });
    featured += 1;
  }

  await prisma.gameweek.update({
    where: { id: gw.id },
    data: { statsComplete: true },
  });

  return { gameweek: gwNumber, playersFeatured: featured };
}

export interface PointsComputeResult {
  gameweek: number;
  playersScored: number;
}

/**
 * Compute base fantasy points for every player who has a stat line in a
 * gameweek (PRD §4), writing PlayerGameweekPoints. Idempotent.
 */
export async function computeGameweekPoints(
  gwNumber: number,
): Promise<PointsComputeResult> {
  const gw = await prisma.gameweek.findUnique({
    where: { number_stage: { number: gwNumber, stage: "LEAGUE" } },
  });
  if (!gw) throw new Error(`Gameweek ${gwNumber} (LEAGUE) not found.`);

  const stats = await prisma.playerGameweekStat.findMany({
    where: { gameweekId: gw.id },
    include: { player: { select: { position: true } } },
  });

  let scored = 0;
  for (const s of stats) {
    const { total } = computeBasePoints({
      position: s.player.position as Position,
      minutesPlayed: s.minutesPlayed,
      minutesExtraTime: s.minutesExtraTime,
      goals: s.goals,
      assists: s.assists,
      cleanSheet: s.cleanSheet,
      goalsConceded: s.goalsConceded,
      saves: s.saves,
      penaltiesSaved: s.penaltiesSaved,
      penaltiesMissed: s.penaltiesMissed,
      yellowCards: s.yellowCards,
      redCards: s.redCards,
      ownGoals: s.ownGoals,
      ballsRecovered: s.ballsRecovered,
      cbitCount: s.cbitCount,
    });

    await prisma.playerGameweekPoints.upsert({
      where: { playerId_gameweekId: { playerId: s.playerId, gameweekId: gw.id } },
      create: { playerId: s.playerId, gameweekId: gw.id, basePoints: total },
      update: { basePoints: total },
    });
    scored += 1;
  }

  await prisma.gameweek.update({
    where: { id: gw.id },
    data: { pointsComputed: true },
  });

  return { gameweek: gwNumber, playersScored: scored };
}
