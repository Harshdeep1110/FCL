import {
  resolveGameweek,
  type ResolveInput,
  type UserLineupInput,
} from "../src/lib/resolution";

let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (!cond) failed += 1;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : ` — ${JSON.stringify(extra)}`}`);
}

function lineup(
  userId: string,
  entries: UserLineupInput["entries"],
  opts: Partial<UserLineupInput> = {},
): UserLineupInput {
  return {
    userId,
    entries,
    benchBoost: false,
    bankerPlayerId: null,
    chipCost: 0,
    transferPenalty: 0,
    ...opts,
  };
}

// --- PRD worked Bounty example: target base 3; 5 owners, 1 captained;
//     buyer (non-owner) gets (4*3)+(1*6)=18 ---------------------------------
{
  const input: ResolveInput = {
    players: new Map([[1, { base: 3, randomBoosted: false }]]),
    redCardPlayerIds: new Set(),
    bounties: [{ buyerId: "buyer", targetPlayerId: 1 }],
    lineups: [
      lineup("o1", [{ playerId: 1, isStarting: true, isCaptain: false }]),
      lineup("o2", [{ playerId: 1, isStarting: true, isCaptain: false }]),
      lineup("o3", [{ playerId: 1, isStarting: true, isCaptain: false }]),
      lineup("o4", [{ playerId: 1, isStarting: true, isCaptain: false }]),
      lineup("o5", [{ playerId: 1, isStarting: true, isCaptain: true }]),
      lineup("buyer", [], { chipCost: 9 }),
    ],
  };
  const out = resolveGameweek(input);
  const buyer = out.scores.find((s) => s.userId === "buyer")!;
  const o5 = out.scores.find((s) => s.userId === "o5")!;
  const o1 = out.scores.find((s) => s.userId === "o1")!;
  check("bounty payout = 18", buyer.bountyGained === 18, buyer.bountyGained);
  check("5 bounty transfers", out.bountyTransfers.length === 5, out.bountyTransfers.length);
  check("captain owner o5 starting = 6", o5.startingPoints === 6, o5.startingPoints);
  check("o5 loses 6", o5.bountyLost === 6, o5.bountyLost);
  check("o1 loses 3, nets 0", o1.total === 0, o1.total);
  check("buyer total = 18 - 9 cost = 9", buyer.total === 9, buyer.total);
}

// --- Bounty wasted if target red-carded --------------------------------------
{
  const input: ResolveInput = {
    players: new Map([[1, { base: 3, randomBoosted: false }]]),
    redCardPlayerIds: new Set([1]),
    bounties: [{ buyerId: "buyer", targetPlayerId: 1 }],
    lineups: [
      lineup("o1", [{ playerId: 1, isStarting: true, isCaptain: false }]),
      lineup("buyer", [], { chipCost: 9 }),
    ],
  };
  const out = resolveGameweek(input);
  const buyer = out.scores.find((s) => s.userId === "buyer")!;
  const o1 = out.scores.find((s) => s.userId === "o1")!;
  check("red-carded target: no bounty", buyer.bountyGained === 0);
  check("red-carded player scores 0 for owner", o1.startingPoints === 0);
  check("buyer still pays chip cost", buyer.total === -9);
}

// --- Multiplier order: captain ×2 then Random Boost ×1.5 ----------------------
{
  const input: ResolveInput = {
    players: new Map([[1, { base: 4, randomBoosted: true }]]),
    redCardPlayerIds: new Set(),
    bounties: [],
    lineups: [lineup("u", [{ playerId: 1, isStarting: true, isCaptain: true }])],
  };
  const out = resolveGameweek(input);
  // 4 * 2 (captain) * 1.5 (boost) = 12
  check("captain+boost = 12", out.scores[0].startingPoints === 12, out.scores[0].startingPoints);
}

// --- Banker ×2, and Bench Boost counts bench ---------------------------------
{
  const input: ResolveInput = {
    players: new Map([
      [1, { base: 5, randomBoosted: false }],
      [2, { base: 3, randomBoosted: false }],
    ]),
    redCardPlayerIds: new Set(),
    bounties: [],
    lineups: [
      lineup(
        "u",
        [
          { playerId: 1, isStarting: true, isCaptain: false },
          { playerId: 2, isStarting: false, isCaptain: false },
        ],
        { bankerPlayerId: 1, benchBoost: true, chipCost: 11 },
      ),
    ],
  };
  const out = resolveGameweek(input);
  const u = out.scores[0];
  check("banker: starting 5*2=10", u.startingPoints === 10, u.startingPoints);
  check("bench points = 3", u.benchPoints === 3, u.benchPoints);
  // 10 + 3 (bench boost) - 11 (chip) = 2
  check("bench boost total = 2", u.total === 2, u.total);
}

// --- Self-ownership: buyer owning target doesn't pay themselves ---------------
{
  const input: ResolveInput = {
    players: new Map([[1, { base: 2, randomBoosted: false }]]),
    redCardPlayerIds: new Set(),
    bounties: [{ buyerId: "buyer", targetPlayerId: 1 }],
    lineups: [
      lineup("buyer", [{ playerId: 1, isStarting: true, isCaptain: false }]),
      lineup("o1", [{ playerId: 1, isStarting: true, isCaptain: false }]),
    ],
  };
  const out = resolveGameweek(input);
  const buyer = out.scores.find((s) => s.userId === "buyer")!;
  check("self-owned excluded: gains only from o1 (2)", buyer.bountyGained === 2, buyer.bountyGained);
  check("only 1 transfer", out.bountyTransfers.length === 1);
}

console.log(failed === 0 ? "\nALL RESOLUTION TESTS PASS" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
