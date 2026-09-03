import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { ingestUefaSeason } from "../src/lib/uefa";

/**
 * Reset football data and ingest the current UEFA season (clubs, players,
 * prices, gameweeks, fixtures). Wipes the previous API-Football/sample data
 * so the app runs cleanly on UEFA 2026/27.
 *
 *   npx tsx scripts/ingest-uefa.ts
 */
async function wipe() {
  // FK-safe order. Users / ApiCallLog / AdminOverride are preserved.
  await prisma.playerGameweekStat.deleteMany();
  await prisma.playerGameweekPoints.deleteMany();
  await prisma.lineupPlayer.deleteMany();
  await prisma.lineup.deleteMany();
  await prisma.squadPlayer.deleteMany();
  await prisma.squad.deleteMany();
  await prisma.priceHistory.deleteMany();
  await prisma.randomBoostSelection.deleteMany();
  await prisma.bountyPayout.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.transferBank.deleteMany();
  await prisma.userGameweekScore.deleteMany();
  await prisma.chipPurchase.deleteMany();
  await prisma.fixture.deleteMany();
  await prisma.gameweek.deleteMany();
  await prisma.player.deleteMany();
  await prisma.club.deleteMany();
}

async function main() {
  console.log("Resetting football data…");
  await wipe();
  console.log("Ingesting UEFA current season…");
  const result = await ingestUefaSeason();
  console.log("Result:", JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
