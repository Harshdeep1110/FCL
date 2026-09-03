import { prisma } from "@/lib/prisma";
import { apiFootballGet } from "@/lib/api-football";
import { DEADLINE_OFFSET_MINUTES } from "@/lib/config";
import type { FixtureStatus, Stage } from "@/generated/prisma/enums";

/** UCL league id in API-Football. */
export const UCL_LEAGUE_ID = 2;

// --- API-Football fixture response (only the fields we use) -----------------
interface ApiFixture {
  fixture: { id: number; date: string; status: { short: string } };
  league: { round: string };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
}

/** Map an API-Football round string to our (stage, gameweek number). */
export function parseRound(
  round: string,
): { stage: Stage; number: number } | null {
  const league = round.match(/League Stage\s*-\s*(\d+)/i);
  if (league) return { stage: "LEAGUE", number: Number(league[1]) };

  if (/Round of 16/i.test(round)) return { stage: "RO16", number: 1 };
  if (/Quarter-?finals?/i.test(round)) return { stage: "QF", number: 1 };
  if (/Semi-?finals?/i.test(round)) return { stage: "SF", number: 1 };
  if (/Final/i.test(round)) return { stage: "FINAL", number: 1 };

  // Knockout-round play-offs (new format) aren't modelled in v1 — skip.
  return null;
}

function mapStatus(short: string): FixtureStatus {
  if (["FT", "AET", "PEN"].includes(short)) return "FINISHED";
  if (["1H", "2H", "HT", "ET", "BT", "P", "LIVE"].includes(short))
    return "LIVE";
  return "SCHEDULED";
}

export interface IngestResult {
  clubs: number;
  gameweeks: number;
  fixtures: number;
  skippedRounds: Record<string, number>;
}

/**
 * One-time bulk fixture pull for a stage/season (PRD §8, call plan item 1).
 * Costs exactly one API call. Idempotent — safe to re-run.
 */
export async function ingestUclFixtures(season: number): Promise<IngestResult> {
  const res = await apiFootballGet<ApiFixture>("/fixtures", {
    league: UCL_LEAGUE_ID,
    season,
  });

  const skippedRounds: Record<string, number> = {};

  // Group fixtures by gameweek key so we can compute each deadline from the
  // earliest kickoff, and collect the distinct clubs.
  const groups = new Map<
    string,
    { stage: Stage; number: number; fixtures: ApiFixture[]; minKickoff: Date }
  >();
  const clubs = new Map<number, string>();

  for (const f of res.response) {
    const parsed = parseRound(f.league.round);
    if (!parsed) {
      skippedRounds[f.league.round] = (skippedRounds[f.league.round] ?? 0) + 1;
      continue;
    }
    // Only register clubs that actually feature in a modelled round.
    clubs.set(f.teams.home.id, f.teams.home.name);
    clubs.set(f.teams.away.id, f.teams.away.name);

    const key = `${parsed.stage}:${parsed.number}`;
    const kickoff = new Date(f.fixture.date);
    const g = groups.get(key);
    if (g) {
      g.fixtures.push(f);
      if (kickoff < g.minKickoff) g.minKickoff = kickoff;
    } else {
      groups.set(key, {
        stage: parsed.stage,
        number: parsed.number,
        fixtures: [f],
        minKickoff: kickoff,
      });
    }
  }

  // Upsert clubs → id map (apiFootballTeamId → Club.id).
  const clubIdByApiId = new Map<number, string>();
  for (const [apiId, name] of clubs) {
    const club = await prisma.club.upsert({
      where: { apiFootballTeamId: apiId },
      create: { name, apiFootballTeamId: apiId },
      update: { name },
    });
    clubIdByApiId.set(apiId, club.id);
  }

  // Upsert gameweeks (deadline = earliest kickoff − offset), then fixtures.
  let fixtureCount = 0;
  for (const g of groups.values()) {
    const deadline = new Date(
      g.minKickoff.getTime() - DEADLINE_OFFSET_MINUTES * 60_000,
    );
    const gw = await prisma.gameweek.upsert({
      where: { number_stage: { number: g.number, stage: g.stage } },
      create: { number: g.number, stage: g.stage, deadline },
      update: { deadline },
    });

    for (const f of g.fixtures) {
      await prisma.fixture.upsert({
        where: { apiFootballFixtureId: f.fixture.id },
        create: {
          apiFootballFixtureId: f.fixture.id,
          clubHomeId: clubIdByApiId.get(f.teams.home.id)!,
          clubAwayId: clubIdByApiId.get(f.teams.away.id)!,
          kickoffTime: new Date(f.fixture.date),
          gameweekId: gw.id,
          stage: g.stage,
          status: mapStatus(f.fixture.status.short),
        },
        update: {
          kickoffTime: new Date(f.fixture.date),
          gameweekId: gw.id,
          status: mapStatus(f.fixture.status.short),
        },
      });
      fixtureCount += 1;
    }
  }

  return {
    clubs: clubs.size,
    gameweeks: groups.size,
    fixtures: fixtureCount,
    skippedRounds,
  };
}
