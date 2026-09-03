import { prisma } from "@/lib/prisma";

export interface StandingRow {
  userId: string;
  name: string;
  total: number;
  gameweeksPlayed: number;
  rank: number;
}

/**
 * League standings: cumulative points per user across all resolved gameweeks,
 * ranked. Includes every participant (0 pts before the season starts).
 * Ties share a rank (standard competition ranking).
 */
export async function getStandings(): Promise<StandingRow[]> {
  const [users, sums] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, email: true } }),
    prisma.userGameweekScore.groupBy({
      by: ["userId"],
      _sum: { total: true },
      _count: { _all: true },
    }),
  ]);

  const byUser = new Map(sums.map((s) => [s.userId, s]));

  const rows = users
    .map((u) => {
      const s = byUser.get(u.id);
      return {
        userId: u.id,
        name: u.name ?? u.email,
        total: s?._sum.total ?? 0,
        gameweeksPlayed: s?._count._all ?? 0,
      };
    })
    .sort((a, b) => b.total - a.total);

  // Standard competition ranking (1,2,2,4).
  let rank = 0;
  let prev: number | null = null;
  return rows.map((r, i) => {
    if (prev === null || r.total !== prev) rank = i + 1;
    prev = r.total;
    return { ...r, rank };
  });
}
