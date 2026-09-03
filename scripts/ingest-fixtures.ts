import "dotenv/config";
import { ingestUclFixtures } from "../src/lib/ingest";
import { callsUsedToday } from "../src/lib/api-football";
import { prisma } from "../src/lib/prisma";

// npx tsx scripts/ingest-fixtures.ts [season]
async function main() {
  const season = Number(process.argv[2] ?? "2024");
  console.log(`Ingesting UCL fixtures for season ${season}…`);
  const result = await ingestUclFixtures(season);
  console.log("Result:", JSON.stringify(result, null, 2));
  console.log("Metered calls used today:", await callsUsedToday());
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
