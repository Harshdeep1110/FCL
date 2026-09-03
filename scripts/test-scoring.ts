import { computeBasePoints, type ScoringStat } from "../src/lib/scoring";

// Lightweight assertion runner for the scoring engine (PRD §4).
let failed = 0;
function expect(name: string, got: number, want: number) {
  const ok = got === want;
  if (!ok) failed += 1;
  console.log(`${ok ? "✓" : "✗"} ${name}: got ${got}, want ${want}`);
}

const cases: { name: string; stat: ScoringStat; want: number }[] = [
  {
    name: "ATT 90' 2 goals 1 assist",
    stat: { position: "ATT", minutesPlayed: 90, goals: 2, assists: 1 },
    want: 2 + 2 * 4 + 3, // 13
  },
  {
    name: "MID 90' 1 goal",
    stat: { position: "MID", minutesPlayed: 90, goals: 1 },
    want: 2 + 5, // 7
  },
  {
    name: "DEF 90' goal",
    stat: { position: "DEF", minutesPlayed: 90, goals: 1 },
    want: 2 + 6, // 8
  },
  {
    name: "DEF 90' clean sheet + 8 bR (def contrib)",
    stat: { position: "DEF", minutesPlayed: 90, cleanSheet: true, ballsRecovered: 8 },
    want: 2 + 4 + 2, // 8
  },
  {
    name: "GK 90' CS, 6 saves, 1 pen save",
    stat: { position: "GK", minutesPlayed: 90, cleanSheet: true, saves: 6, penaltiesSaved: 1 },
    want: 2 + 4 + Math.floor(6 / 3) + 5, // 13
  },
  {
    name: "GK 90' concedes 3",
    stat: { position: "GK", minutesPlayed: 90, goalsConceded: 3 },
    want: 2 - 1, // floor(3/2)=1 → -1 => 1
  },
  {
    name: "MID 45' 1 goal + yellow",
    stat: { position: "MID", minutesPlayed: 45, goals: 1, yellowCards: 1 },
    want: 1 + 5 - 1, // 5
  },
  {
    name: "DEF 90' own goal + red",
    stat: { position: "DEF", minutesPlayed: 90, ownGoals: 1, redCards: 1 },
    want: 2 - 2 - 3, // -3
  },
  {
    name: "MID bR=8 meets def contrib",
    stat: { position: "MID", minutesPlayed: 90, ballsRecovered: 8 },
    want: 2 + 2, // 4
  },
  {
    name: "MID bR=7 below def contrib",
    stat: { position: "MID", minutesPlayed: 90, ballsRecovered: 7 },
    want: 2, // 2
  },
  {
    name: "GK never gets def contrib (bR huge)",
    stat: { position: "GK", minutesPlayed: 90, ballsRecovered: 99, goalsConceded: 0 },
    want: 2, // appearance only
  },
  {
    name: "Sub 20' no other stats",
    stat: { position: "ATT", minutesPlayed: 20 },
    want: 1,
  },
  {
    name: "Unused sub 0'",
    stat: { position: "ATT", minutesPlayed: 0 },
    want: 0,
  },
  {
    name: "ATT extra-time pushes to 60+ tier",
    stat: { position: "ATT", minutesPlayed: 45, minutesExtraTime: 20 },
    want: 2, // 65 total → long tier
  },
  {
    name: "API-Football CBIT path: DEF 10 CBIT",
    stat: { position: "DEF", minutesPlayed: 90, cbitCount: 10 },
    want: 2 + 2, // appearance + def contrib
  },
];

for (const c of cases) {
  expect(c.name, computeBasePoints(c.stat).total, c.want);
}

console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
