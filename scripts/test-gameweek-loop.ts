import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { buyChip } from "../src/lib/chips";
import { lockGameweek } from "../src/lib/lineup";
import { resolveGameweekPersisted } from "../src/lib/resolve-gameweek";

// End-to-end DB loop: squads → chip → lock → resolve → assert → cleanup.
let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (!cond) failed += 1;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : ` — ${JSON.stringify(extra)}`}`);
}

async function main() {
  const gw = await prisma.gameweek.findFirstOrThrow({ where: { number: 1, stage: "LEAGUE" } });
  const [pX, pY] = await prisma.player.findMany({ take: 2, orderBy: { id: "asc" } });

  const A = await prisma.user.create({ data: { email: "test_a@loop.local", name: "A" } });
  const B = await prisma.user.create({ data: { email: "test_b@loop.local", name: "B" } });

  const cleanup = async () => {
    const ids = [A.id, B.id];
    await prisma.lineupPlayer.deleteMany({ where: { lineup: { userId: { in: ids } } } });
    await prisma.lineup.deleteMany({ where: { userId: { in: ids } } });
    await prisma.userGameweekScore.deleteMany({ where: { userId: { in: ids } } });
    await prisma.bountyPayout.deleteMany({ where: { OR: [{ buyerId: { in: ids } }, { ownerId: { in: ids } }] } });
    await prisma.chipPurchase.deleteMany({ where: { userId: { in: ids } } });
    await prisma.squadPlayer.deleteMany({ where: { squad: { userId: { in: ids } } } });
    await prisma.squad.deleteMany({ where: { userId: { in: ids } } });
    await prisma.playerGameweekPoints.deleteMany({ where: { gameweekId: gw.id, playerId: { in: [pX.id, pY.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.gameweek.update({ where: { id: gw.id }, data: { locked: false, chipsResolved: false } });
  };

  try {
    // Base points: pX = 3 (bounty target, <4), pY = 5.
    await prisma.playerGameweekPoints.create({ data: { playerId: pX.id, gameweekId: gw.id, basePoints: 3 } });
    await prisma.playerGameweekPoints.create({ data: { playerId: pY.id, gameweekId: gw.id, basePoints: 5 } });

    // Squads: A captains pY; B starts pX.
    const sqA = await prisma.squad.create({ data: { userId: A.id, stage: "LEAGUE", budget: 100 } });
    const sqB = await prisma.squad.create({ data: { userId: B.id, stage: "LEAGUE", budget: 100 } });
    await prisma.squadPlayer.create({ data: { squadId: sqA.id, playerId: pY.id, isStarting: true, isCaptain: true, priceAtDraft: pY.currentPrice } });
    await prisma.squadPlayer.create({ data: { squadId: sqB.id, playerId: pX.id, isStarting: true, isCaptain: false, priceAtDraft: pX.currentPrice } });

    // A buys a free Bounty chip targeting pX (owned by B).
    const buy = await buyChip({ userId: A.id, chipType: "BOUNTY", gameweekId: gw.id, targetPlayerId: pX.id });
    check("chip purchase ok", buy.ok, buy);

    // Lock + resolve.
    const lock = await lockGameweek(1);
    check("locked >= 2 lineups", lock.lineupsLocked >= 2, lock.lineupsLocked);
    const res = await resolveGameweekPersisted(1);
    check("resolved users", res.usersScored >= 2, res.usersScored);

    const scoreA = await prisma.userGameweekScore.findUniqueOrThrow({ where: { userId_gameweekId: { userId: A.id, gameweekId: gw.id } } });
    const scoreB = await prisma.userGameweekScore.findUniqueOrThrow({ where: { userId_gameweekId: { userId: B.id, gameweekId: gw.id } } });

    check("A captain pY: starting 10", scoreA.startingPoints === 10, scoreA.startingPoints);
    check("A bounty gained 3 (pX from B)", scoreA.bountyGained === 3, scoreA.bountyGained);
    check("A total 13", scoreA.total === 13, scoreA.total);
    check("B starting 3", scoreB.startingPoints === 3, scoreB.startingPoints);
    check("B bounty lost 3", scoreB.bountyLost === 3, scoreB.bountyLost);
    check("B total 0", scoreB.total === 0, scoreB.total);
  } finally {
    await cleanup();
    console.log("cleaned up test data.");
  }

  console.log(failed === 0 ? "\nLOOP TEST PASS" : `\n${failed} FAILED`);
  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
