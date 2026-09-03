import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { UEFA, DEADLINE_OFFSET_MINUTES } from "@/lib/config";
import type { FixtureStatus, Position } from "@/generated/prisma/enums";

// ---------------------------------------------------------------------------
// UEFA fantasy feed client (primary source, current season — PRD §8a).
// Plain fetch works (Akamai blocks curl's TLS fingerprint, not undici's).
// All feeds wrap payloads in { data: { value: ... } }.
// ---------------------------------------------------------------------------

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchFeed<T>(path: string): Promise<T> {
  const res = await fetch(`${UEFA.baseUrl}${path}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`UEFA feed ${path} returned HTTP ${res.status}`);
  }
  const json = (await res.json()) as { data: { value: T } };
  return json.data.value;
}

// --- Feed shapes (only the fields we use) ----------------------------------

interface UefaTeam {
  id: number;
  webName: string;
  cCode: string;
  isEliminated: number | null;
}

export interface UefaPlayer {
  id: string;
  pDName: string;
  latinName: string;
  tId: string;
  skill: number;
  value: number;
  isActive: number;
  // Season-cumulative stat fields (diffed between matchdays for per-GW stats).
  minsPlyd: number;
  gS: number; // goals scored
  assist: number;
  cS: number; // clean sheets (count)
  gC: number; // goals conceded
  yC: number; // yellow cards
  rC: number; // red cards
  oG: number; // own goals
  pS: number; // penalties saved
  pM: number; // penalties missed
  saves: number;
  bR: number; // balls recovered
}

interface UefaMatch {
  mId: number;
  dateTime: string; // "MM/DD/YYYY HH:mm:ss" in Europe/Zurich
  htId: number;
  atId: number;
  matchStatus: string;
  isLive: number;
}

interface UefaMatchday {
  mdId: number;
  gameday: number;
  phId: number;
  deadline: string;
  match: UefaMatch[];
}

// --- Feed fetchers ----------------------------------------------------------

export const fetchTeams = () =>
  fetchFeed<UefaTeam[]>(`/teams/teams_${UEFA.feedId}_en.json`);

export const fetchFixtures = () =>
  fetchFeed<UefaMatchday[]>(`/fixtures/fixtures_${UEFA.feedId}_en.json`);

export const fetchPlayers = (matchday = 1) =>
  fetchFeed<{ playerList: UefaPlayer[] }>(
    `/players/players_${UEFA.feedId}_en_${matchday}.json`,
  ).then((v) => v.playerList);

// --- Helpers ----------------------------------------------------------------

/** Parse a UEFA "MM/DD/YYYY HH:mm:ss" timestamp (Europe/Zurich) into UTC. */
export function parseUefaDate(s: string): Date {
  const dt = DateTime.fromFormat(s.trim(), "MM/dd/yyyy HH:mm:ss", {
    zone: UEFA.timezone,
  });
  if (!dt.isValid) throw new Error(`Unparseable UEFA date: "${s}"`);
  return dt.toUTC().toJSDate();
}

function mapMatchStatus(m: UefaMatch): FixtureStatus {
  if (m.isLive === 1) return "LIVE";
  // UEFA matchStatus: "0" scheduled; finished matches carry a higher code.
  if (m.matchStatus && m.matchStatus !== "0") return "FINISHED";
  return "SCHEDULED";
}

export interface UefaIngestResult {
  clubs: number;
  players: number;
  gameweeks: number;
  fixtures: number;
  eliminatedClubs: number;
}

/**
 * Ingest UEFA static data for the current season: clubs (+ elimination),
 * players (+ prices + positions), and the league-phase gameweeks/fixtures.
 * Idempotent — upserts on the UEFA ids. No API-Football quota used.
 */
export async function ingestUefaSeason(): Promise<UefaIngestResult> {
  const [teams, players, matchdays] = await Promise.all([
    fetchTeams(),
    fetchPlayers(1),
    fetchFixtures(),
  ]);

  // Clubs.
  const clubIdByUefaId = new Map<number, string>();
  let eliminated = 0;
  for (const t of teams) {
    const isElim = !!t.isEliminated;
    if (isElim) eliminated += 1;
    const club = await prisma.club.upsert({
      where: { uefaTeamId: t.id },
      create: {
        name: t.webName,
        uefaTeamId: t.id,
        eliminated: isElim,
        eliminatedAt: isElim ? new Date() : null,
      },
      update: { name: t.webName, eliminated: isElim },
    });
    clubIdByUefaId.set(t.id, club.id);
  }

  // Players (+ prices). originalPrice is set once, on create.
  let playerCount = 0;
  for (const p of players) {
    const clubId = clubIdByUefaId.get(Number(p.tId));
    if (!clubId) continue; // player without a modelled club — skip
    const position = UEFA.positionBySkill[p.skill] as Position | undefined;
    if (!position) continue;

    await prisma.player.upsert({
      where: { uefaPlayerId: p.id },
      create: {
        name: p.latinName || p.pDName,
        position,
        clubId,
        uefaPlayerId: p.id,
        currentPrice: p.value,
        originalPrice: p.value,
      },
      update: {
        name: p.latinName || p.pDName,
        position,
        clubId,
        currentPrice: p.value,
      },
    });
    playerCount += 1;
  }

  // Gameweeks + fixtures (league phase = phId 1).
  let fixtureCount = 0;
  let gwCount = 0;
  for (const md of matchdays.filter((m) => m.phId === 1)) {
    if (md.match.length === 0) continue;
    const kickoffs = md.match.map((m) => parseUefaDate(m.dateTime));
    const earliest = new Date(Math.min(...kickoffs.map((d) => d.getTime())));
    const deadline = new Date(
      earliest.getTime() - DEADLINE_OFFSET_MINUTES * 60_000,
    );

    const gw = await prisma.gameweek.upsert({
      where: { number_stage: { number: md.mdId, stage: "LEAGUE" } },
      create: { number: md.mdId, stage: "LEAGUE", deadline },
      update: { deadline },
    });
    gwCount += 1;

    for (const m of md.match) {
      const homeId = clubIdByUefaId.get(m.htId);
      const awayId = clubIdByUefaId.get(m.atId);
      if (!homeId || !awayId) continue;
      await prisma.fixture.upsert({
        where: { uefaMatchId: String(m.mId) },
        create: {
          uefaMatchId: String(m.mId),
          clubHomeId: homeId,
          clubAwayId: awayId,
          kickoffTime: parseUefaDate(m.dateTime),
          gameweekId: gw.id,
          stage: "LEAGUE",
          status: mapMatchStatus(m),
        },
        update: {
          kickoffTime: parseUefaDate(m.dateTime),
          gameweekId: gw.id,
          status: mapMatchStatus(m),
        },
      });
      fixtureCount += 1;
    }
  }

  return {
    clubs: teams.length,
    players: playerCount,
    gameweeks: gwCount,
    fixtures: fixtureCount,
    eliminatedClubs: eliminated,
  };
}
