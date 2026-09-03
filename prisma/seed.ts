import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import type { Position } from "../src/generated/prisma/enums";

/**
 * Sample seed: real UCL clubs + named star players, auto-filled to a full
 * roster per club (2 GK / 5 DEF / 5 MID / 3 ATT). Enough depth to draft a
 * valid 15-player squad under the 3-per-club cap. Prices are plausible UEFA
 * Fantasy-style values. Replaced by the real UEFA seed (§8a) later.
 *
 * Idempotent: upserts on apiFootballTeamId / apiFootballPlayerId.
 *   npm run db:seed
 */

type Star = [name: string, position: Position, price: number];

interface ClubSeed {
  name: string;
  apiId: number;
  stars: Star[];
}

// Required roster shape per club (matches league-phase squad math with headroom).
const ROSTER: Record<Position, number> = { GK: 2, DEF: 5, MID: 5, ATT: 3 };

const CLUBS: ClubSeed[] = [
  {
    name: "Real Madrid",
    apiId: 9001,
    stars: [
      ["T. Courtois", "GK", 5.5],
      ["A. Rüdiger", "DEF", 5.5],
      ["D. Carvajal", "DEF", 6.0],
      ["J. Bellingham", "MID", 9.5],
      ["F. Valverde", "MID", 7.0],
      ["Vinícius Jr", "ATT", 10.5],
      ["K. Mbappé", "ATT", 11.5],
    ],
  },
  {
    name: "Manchester City",
    apiId: 9002,
    stars: [
      ["Ederson", "GK", 5.5],
      ["R. Dias", "DEF", 5.5],
      ["J. Gvardiol", "DEF", 5.5],
      ["Rodri", "MID", 6.5],
      ["K. De Bruyne", "MID", 9.0],
      ["P. Foden", "MID", 8.0],
      ["E. Haaland", "ATT", 11.5],
    ],
  },
  {
    name: "Bayern München",
    apiId: 9003,
    stars: [
      ["M. Neuer", "GK", 5.0],
      ["Kim Min-jae", "DEF", 5.0],
      ["A. Davies", "DEF", 5.5],
      ["J. Kimmich", "MID", 6.5],
      ["J. Musiala", "MID", 8.5],
      ["L. Sané", "ATT", 7.5],
      ["H. Kane", "ATT", 11.0],
    ],
  },
  {
    name: "Liverpool",
    apiId: 9004,
    stars: [
      ["Alisson", "GK", 5.5],
      ["V. van Dijk", "DEF", 6.0],
      ["T. Alexander-Arnold", "DEF", 6.5],
      ["D. Szoboszlai", "MID", 6.5],
      ["A. Mac Allister", "MID", 6.0],
      ["M. Salah", "ATT", 11.0],
      ["D. Núñez", "ATT", 7.5],
    ],
  },
  {
    name: "Arsenal",
    apiId: 9005,
    stars: [
      ["D. Raya", "GK", 5.0],
      ["W. Saliba", "DEF", 6.0],
      ["Gabriel", "DEF", 5.5],
      ["D. Rice", "MID", 6.5],
      ["M. Ødegaard", "MID", 8.0],
      ["B. Saka", "ATT", 9.5],
      ["K. Havertz", "ATT", 7.5],
    ],
  },
  {
    name: "FC Barcelona",
    apiId: 9006,
    stars: [
      ["M. ter Stegen", "GK", 5.5],
      ["J. Koundé", "DEF", 5.5],
      ["P. Cubarsí", "DEF", 5.0],
      ["Pedri", "MID", 7.0],
      ["İ. Gündoğan", "MID", 6.5],
      ["L. Yamal", "ATT", 9.0],
      ["R. Lewandowski", "ATT", 9.5],
    ],
  },
  {
    name: "Paris Saint-Germain",
    apiId: 9007,
    stars: [
      ["G. Donnarumma", "GK", 5.5],
      ["Marquinhos", "DEF", 5.5],
      ["A. Hakimi", "DEF", 6.0],
      ["Vitinha", "MID", 6.0],
      ["W. Zaïre-Emery", "MID", 6.0],
      ["O. Dembélé", "ATT", 8.0],
      ["B. Barcola", "ATT", 7.5],
    ],
  },
  {
    name: "Inter",
    apiId: 9008,
    stars: [
      ["Y. Sommer", "GK", 5.0],
      ["A. Bastoni", "DEF", 5.5],
      ["B. Pavard", "DEF", 5.0],
      ["N. Barella", "MID", 6.5],
      ["H. Çalhanoğlu", "MID", 6.5],
      ["L. Martínez", "ATT", 9.0],
      ["M. Thuram", "ATT", 7.5],
    ],
  },
  {
    name: "Borussia Dortmund",
    apiId: 9009,
    stars: [
      ["G. Kobel", "GK", 5.0],
      ["N. Schlotterbeck", "DEF", 5.0],
      ["J. Ryerson", "DEF", 4.5],
      ["J. Brandt", "MID", 6.0],
      ["M. Sabitzer", "MID", 5.5],
      ["K. Adeyemi", "ATT", 6.5],
      ["S. Guirassy", "ATT", 7.5],
    ],
  },
  {
    name: "Atlético Madrid",
    apiId: 9010,
    stars: [
      ["J. Oblak", "GK", 5.5],
      ["J. Giménez", "DEF", 5.0],
      ["N. Molina", "DEF", 5.0],
      ["Koke", "MID", 5.5],
      ["P. Barrios", "MID", 5.5],
      ["A. Griezmann", "ATT", 8.0],
      ["J. Álvarez", "ATT", 8.5],
    ],
  },
  {
    name: "AC Milan",
    apiId: 9011,
    stars: [
      ["M. Maignan", "GK", 5.5],
      ["F. Tomori", "DEF", 5.0],
      ["T. Hernández", "DEF", 6.0],
      ["T. Reijnders", "MID", 6.0],
      ["Y. Fofana", "MID", 5.5],
      ["R. Leão", "ATT", 8.5],
      ["C. Pulisic", "ATT", 7.5],
    ],
  },
  {
    name: "Juventus",
    apiId: 9012,
    stars: [
      ["M. Di Gregorio", "GK", 5.0],
      ["Bremer", "DEF", 5.5],
      ["A. Cambiaso", "DEF", 5.5],
      ["M. Locatelli", "MID", 5.5],
      ["W. McKennie", "MID", 5.0],
      ["D. Vlahović", "ATT", 8.0],
      ["K. Yıldız", "ATT", 6.5],
    ],
  },
];

// Baseline depth-player price by position (below star prices).
const DEPTH_BASE: Record<Position, number> = { GK: 4.5, DEF: 4.5, MID: 5.0, ATT: 6.0 };

const POSITIONS: Position[] = ["GK", "DEF", "MID", "ATT"];

async function main() {
  let apiPlayerId = 100000; // fake sequential API-Football player ids
  let created = 0;

  for (const club of CLUBS) {
    const dbClub = await prisma.club.upsert({
      where: { apiFootballTeamId: club.apiId },
      create: { name: club.name, apiFootballTeamId: club.apiId },
      update: { name: club.name },
    });

    for (const pos of POSITIONS) {
      const starsAtPos = club.stars.filter(([, p]) => p === pos);
      const need = ROSTER[pos];
      const roster: Star[] = [...starsAtPos];

      // Fill remaining slots with deterministic depth players.
      let n = 1;
      while (roster.length < need) {
        const price = DEPTH_BASE[pos] + (n % 2 === 0 ? 0.5 : 0);
        roster.push([`${club.name} ${pos}${n + starsAtPos.length}`, pos, price]);
        n += 1;
      }

      for (const [name, position, price] of roster) {
        apiPlayerId += 1;
        await prisma.player.upsert({
          where: { apiFootballPlayerId: apiPlayerId },
          create: {
            name,
            position,
            clubId: dbClub.id,
            apiFootballPlayerId: apiPlayerId,
            currentPrice: price,
            originalPrice: price,
          },
          update: { name, position, clubId: dbClub.id, currentPrice: price },
        });
        created += 1;
      }
    }
  }

  console.log(`✔ Seeded ${CLUBS.length} clubs and ${created} players.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
