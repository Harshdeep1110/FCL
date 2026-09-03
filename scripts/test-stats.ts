import "dotenv/config";
import { matchdayDelta } from "../src/lib/stats";
import type { UefaPlayer } from "../src/lib/uefa";

let failed = 0;
function check(name: string, cond: boolean) {
  if (!cond) failed += 1;
  console.log(`${cond ? "✓" : "✗"} ${name}`);
}

const base: UefaPlayer = {
  id: "1", pDName: "x", latinName: "x", tId: "1", skill: 3, value: 5, isActive: 1,
  minsPlyd: 0, gS: 0, assist: 0, cS: 0, gC: 0, yC: 0, rC: 0, oG: 0, pS: 0, pM: 0, saves: 0, bR: 0,
};

// Cumulative diff between two matchdays.
const d1 = matchdayDelta(
  { ...base, minsPlyd: 180, gS: 2, assist: 1, cS: 1, bR: 10 },
  { ...base, minsPlyd: 90, gS: 1, assist: 1, cS: 1, bR: 4 },
);
check("minutes delta 90", d1.minutesPlayed === 90);
check("goals delta 1", d1.goals === 1);
check("assists delta 0", d1.assists === 0);
check("cleanSheet false (no new CS)", d1.cleanSheet === false);
check("bR delta 6", d1.ballsRecovered === 6);

// MD1 (no prev) → deltas equal current.
const d2 = matchdayDelta({ ...base, minsPlyd: 90, gS: 1, cS: 1 }, null);
check("MD1 minutes = current", d2.minutesPlayed === 90);
check("MD1 cleanSheet true", d2.cleanSheet === true);

// Negatives clamp to 0 (data corrections shouldn't produce negative stats).
const d3 = matchdayDelta({ ...base, gS: 1 }, { ...base, gS: 3 });
check("negative goals clamped to 0", d3.goals === 0);

console.log(failed === 0 ? "\nPURE TESTS PASS" : `\n${failed} FAILED`);

async function liveSmoke() {
  const { prisma } = await import("../src/lib/prisma");
  const { ingestGameweekStats, computeGameweekPoints } = await import("../src/lib/stats");
  console.log("\n--- LIVE smoke (GW1, pre-season carryover) ---");
  const ing = await ingestGameweekStats(1);
  const pts = await computeGameweekPoints(1);
  console.log("ingest:", JSON.stringify(ing), "| compute:", JSON.stringify(pts));

  const gw = await prisma.gameweek.findFirst({ where: { number: 1, stage: "LEAGUE" } });
  const top = await prisma.playerGameweekPoints.findMany({
    where: { gameweekId: gw!.id },
    orderBy: { basePoints: "desc" },
    take: 5,
    include: { player: { select: { name: true, position: true } } },
  });
  console.log("Top 5 by our scoring:");
  for (const t of top) console.log(`  ${t.player.name} (${t.player.position}): ${t.basePoints}`);

  // Clean up pre-season noise so real GW1 starts fresh.
  await prisma.playerGameweekPoints.deleteMany({ where: { gameweekId: gw!.id } });
  await prisma.playerGameweekStat.deleteMany({ where: { gameweekId: gw!.id } });
  await prisma.gameweek.update({ where: { id: gw!.id }, data: { statsComplete: false, pointsComputed: false } });
  console.log("Cleaned up GW1 pre-season stats/points.");
  await prisma.$disconnect();
}

(async () => {
  if (process.argv.includes("--live")) await liveSmoke();
  process.exit(failed === 0 ? 0 : 1);
})();
