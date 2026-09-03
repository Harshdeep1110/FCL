import "dotenv/config";
import { apiFootballStatus, apiFootballGet, callsUsedToday } from "../src/lib/api-football";
import { prisma } from "../src/lib/prisma";

// Verify the API-Football key + plan (free /status call), then probe whether
// the Champions League (league id 2) is accessible and for which seasons.
async function main() {
  const status = (await apiFootballStatus()) as unknown as {
    response: {
      subscription?: { plan?: string; active?: boolean; end?: string };
      requests?: { current?: number; limit_day?: number };
    };
  };
  const sub = status.response?.subscription;
  const req = status.response?.requests;
  console.log("PLAN:", sub?.plan, "| active:", sub?.active, "| ends:", sub?.end);
  console.log("QUOTA today:", req?.current, "/", req?.limit_day);

  const probeSeason = process.argv[2] ?? "2024";
  console.log(`\nProbing UCL (league=2) coverage for season ${probeSeason}…`);
  const leagues = await apiFootballGet<{
    league: { id: number; name: string };
    seasons: { year: number; coverage: { fixtures: { events: boolean; statistics_players: boolean } } }[];
  }>("/leagues", { id: 2, season: probeSeason });

  const l = leagues.response[0];
  if (!l) {
    console.log("No league data returned. errors:", JSON.stringify(leagues.errors));
  } else {
    console.log("League:", l.league.name);
    for (const s of l.seasons) {
      console.log(
        `  season ${s.year}: fixtures.events=${s.coverage.fixtures.events} players.stats=${s.coverage.fixtures.statistics_players}`,
      );
    }
  }

  console.log("\nMetered calls used today (our log):", await callsUsedToday());
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
