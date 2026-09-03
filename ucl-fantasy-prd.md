# PRD: UCL Fantasy League — v1.0

## 1. Product Summary
A private, invite-only fantasy football web app for a small group (~10 participants) built around the UEFA Champions League. Participants draft squads under a budget cap, set a weekly starting XI, earn points from real player performances, and buy "black market" chips using their own points to disrupt rivals or boost themselves. One overall winner is the participant with the highest cumulative points at the end of the competition.

**Target platform:** Web app, deployed on Vercel.
**Scale:** ~10 concurrent users. Not built for public scale — optimize for correctness and low operating cost (free-tier API budget), not throughput.

---

## 2. Tech Stack (proposed)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14+ (App Router), TypeScript** | Native Vercel deployment, API routes + server actions in one repo, good fit for a small full-stack app |
| Database | **Postgres** (Vercel Postgres, Neon, or Supabase — any works) | Relational data (squads, players, points, price history) fits relational modeling well |
| ORM | **Prisma** | Type-safe schema, easy migrations, works cleanly with Next.js + Vercel |
| Auth | **NextAuth.js (Auth.js)**, email/magic-link or simple credentials since it's invite-only for ~10 known users | No need for social login complexity at this scale |
| Scheduled jobs | **Vercel Cron Jobs** | Needed for: post-fulltime stats pulls, price recalculation, chip resolution, Random Boost selection, deadline locking |
| Styling | **Tailwind CSS** | Fast to build with, pairs well with Next.js |
| External data | **API-Football (API-Sports)**, free tier | See Section 6 for exact call budget/plan |
| Caching (optional) | **Upstash Redis** (serverless, free tier) | Optional — only needed if you want to cache computed standings/leaderboards; not required for the API call budget itself, since that's handled by DB caching |

**Note to Claude Code:** this stack is a recommendation, not a hard requirement — flag if a simpler approach (e.g. SQLite via Vercel-compatible driver, or a single ORM alternative) better fits build speed for a 10-user app.

---

## 3. Core Domain Model

### 3.1 Entities
- **User** — a participant. Fields: id, name, email, isAdmin, createdAt
- **Club** — a UCL team. Fields: id, name, apiFootballTeamId, eliminated (bool), eliminatedAt
- **Player** — a real footballer. Fields: id, name, clubId, position (GK/DEF/MID/ATT), apiFootballPlayerId, currentPrice, originalPrice
- **Fixture** — a real UCL match. Fields: id, apiFootballFixtureId, clubHomeId, clubAwayId, kickoffTime, gameweek, stage (LEAGUE/RO16/QF/SF/FINAL), status (SCHEDULED/LIVE/FINISHED), statsPulled (bool)
- **PlayerGameweekStat** — raw per-player, per-fixture stats pulled from the API. Fields: playerId, fixtureId, minutesPlayed, minutesExtraTime, goals, assists, cleanSheet (bool), goalsConceded, saves, penaltiesSaved, penaltiesMissed, yellowCards, redCards, ownGoals, cbitCount, isDefensiveContributionMet (bool)
- **PlayerGameweekPoints** — computed fantasy points per player per gameweek, derived from PlayerGameweekStat via the scoring table (Section 4)
- **Squad** — a user's drafted squad for a given stage (LEAGUE or KNOCKOUT). Fields: id, userId, stage, budget, budgetSpent
- **SquadPlayer** — join table: squadId, playerId, isStarting (bool), isCaptain (bool, if captaincy is part of final design — confirm), priceAtDraft
- **Gameweek** — fields: id, number, stage, deadline (computed = earliest fixture kickoff − 1hr), locked (bool)
- **ChipType** — enum: RED_CARD, BANKER, INFLATION, BENCH_BOOST, BOUNTY, FREE_HIT
- **ChipPurchase** — userId, chipType, gameweekId, pointsCost, targetPlayerId (nullable, used by Red Card/Banker/Inflation/Bounty), resolved (bool), resultPoints (nullable, net effect applied)
- **RandomBoostSelection** — gameweekId, playerId (5 rows per gameweek), selectedAt (must be after deadline)
- **PriceHistory** — playerId, gameweekId, priceBefore, priceAfter, rawDelta, smoothedDelta
- **TransferBank** — userId, gameweekId, freeTransfersAvailable (capped at 3)
- **Transfer** — userId, gameweekId, playerOutId, playerInId, wasFreeTransfer (bool), pointsPenalty (0 or −4, applied if beyond the free/banked allowance)
- **Standing** — userId, totalPoints, rank (computed/materialized, not necessarily a stored table — could be a view)
- **AdminOverride** — id, adminUserId, targetType (PlayerGameweekStat/ChipPurchase/etc.), targetId, fieldChanged, oldValue, newValue, reason, createdAt

### 3.2 Squad Composition Rules
**League phase draft:**
- Budget: 100M
- Squad: 15 players — 2 GK, 5 DEF, 5 MID, 3 ATT
- Max 3 players from one club
- Starting XI (11): 1 GK (exactly), 3–5 DEF, 3–5 MID, 1–3 ATT; 4 players benched

### 3.3 Transfers (DECIDED)
- **1 free transfer per gameweek** during the league phase
- If unused, it **rolls over** to the next gameweek, up to a **maximum bank of 3** free transfers held at once
- **Extra transfers beyond the bank (DECIDED):** allowed, at a cost of **−4 points per extra transfer**, deducted from that gameweek's total
- Applies to league-phase gameweeks only; the knockout redraft (Section 3.2/7) is a separate full-rebuild mechanic, not a transfer

**Knockout-stage redraft (triggered once, after league phase ends):**
- Budget: 50M (fresh — confirm with product owner whether this is a hard reset or scales with league-phase performance; **current assumption: hard reset, flag if wrong**)
- Squad: 7 players — 1 GK, 2 DEF, 2 MID, 2 ATT
- Starting 5: 1 GK (exactly) + any 4 of the remaining 6 (no sub-position minimums)
- 2 benched
- Club limit: **assume same 3-per-club cap applies — confirm**

---

## 4. Scoring System

Computed per player, per fixture, from `PlayerGameweekStat`:

| Action | Points |
|---|---|
| Played 1–59 mins (incl. extra time) | 1 |
| Played 60+ mins (incl. extra time) | 2 |
| Goal — GK/DEF | 6 |
| Goal — MID | 5 |
| Goal — ATT | 4 |
| Assist | 3 |
| Clean sheet — GK/DEF | 4 |
| Clean sheet — MID | 1 |
| Every 3 saves — GK | 1 |
| Penalty save | 5 |
| Penalty miss | −2 |
| Every 2 goals conceded — GK/DEF | −1 |
| Yellow card | −1 |
| Red card | −3 |
| Own goal | −2 |
| Defensive contribution — DEF (10+ CBIT in match) | 2 (capped, one-time per match) |
| Defensive contribution — MID/ATT (12+ CBIT+recoveries in match) | 2 (capped, one-time per match) |

**Explicitly excluded:** bonus points / BPS — not part of this system.
**Explicitly excluded:** penalty shootout actions — do not score.
**Explicitly included:** extra-time minutes count toward appearance-points tiers.

If a player features for multiple fixtures in one gameweek (rare, but possible with rescheduled fixtures), sum points across all their fixtures that gameweek.

---

## 5. Chip System ("Black Market")

Every user gets **1 free chip** at game start. All subsequent chip purchases cost points, deducted from the buyer's running total. Exact point-cost pricing per chip is **TBD — needs a pricing table before build** (flagged as an open item).

| Chip | Effect | Resolution logic |
|---|---|---|
| **Red Card** | Targeted player scores 0 for all participants that matchday | Zero out that player's `PlayerGameweekPoints` for every squad, before any other chip effects apply |
| **Banker** | Doubles a target player's points, for the buyer only, that matchweek | Apply 2x multiplier to buyer's copy of that player's points only |
| **Inflation** | Raises a target club's player prices by 10%, affecting **all participants** | Applied to `Player.currentPrice` for every player at that club — a shared market event, not user-scoped |
| **Bench Boost** | Buyer's bench points count toward their total that matchweek | Sum bench players' points into buyer's gameweek total |
| **Bounty** | If target player's **base points** (pre-multiplier) for the gameweek are **< 4**, buyer collects that player's total scored points (including any multipliers those owners applied, e.g. captaincy) from **every participant who owned them** that week | See worked example below and open questions |
| **Free Hit** | One-week unlimited free transfer for the buyer; squad reverts after that gameweek | Snapshot buyer's pre-Free-Hit squad, restore it after gameweek scoring is finalized |

**Bounty worked example:** Target scores 3 base points. 5 owners, 1 of them captained. Buyer receives `(4 × 3) + (1 × 6) = 18` points, deducted from those 5 owners' totals.

**Bounty threshold rule (DECIDED):** Bounty checks **only the target's raw base points** — the pre-multiplier score from the scoring table (Section 4), before Banker, Random Boost, or any other chip is applied. Nothing else affects whether Bounty triggers, including the target's own multipliers.

**Order of operations for stacked multipliers (DECIDED):** Random Boost's 1.5x is always applied **last**, after Banker's 2x (or captaincy's 2x, if captaincy exists in the final design). So the computation order per player, per gameweek is:
1. Raw base points from the scoring table (this is what Bounty's `< 4` check reads)
2. Apply Banker's 2x, if bought on this player, for the buyer's copy only
3. Apply Random Boost's 1.5x, if this player was selected, to every squad that owns them
4. Resolve Bounty payouts (reading step 1's raw value for the threshold check, but transferring the **final post-multiplier points** — as shown in the worked example, where the captain's owner pays out 6, not 3)

**Bounty self-ownership rule (DECIDED):** if the buyer also owns (or captains) the target, their own stake is excluded from the payout — they cannot profit from their own ownership.

**Bounty vs. Red Card rule (DECIDED):** if the target was also hit by a Red Card that gameweek, Bounty does **not** trigger — the chip is wasted (buyer gets nothing back, points spent on it are lost).

**Open questions to resolve before/during build (flagged from design discussion):**
1. Confirm whether transfers beyond the banked amount are blocked or allowed with a points penalty
2. Confirm exact UEFA Fantasy internal API endpoint once identified by inspection (Section 8a)

---

## 5a. Chip Pricing (DECIDED — starting values, tune after a few live gameweeks)

Everyone's first chip is free (Section 5). Every purchase after that costs points from the buyer's running total, per this table:

| Chip | Cost (points) | Reasoning |
|---|---|---|
| Inflation | 7 | Indirect, market-wide effect — no direct point swing, so cheapest |
| Bounty | 9 (DECIDED) | High variance, all-or-nothing — real chance of a total loss if the target beats the 4-point threshold or is Red-Carded |
| Bench Boost | 11 | Reliable, modest guaranteed upside — roughly the expected total of 4 bench players in an average week |
| Banker | 14 | Reliable, larger guaranteed upside — effectively risk-free once bought (worst case is doubling a blank, i.e. 2×0) |
| Red Card | 15 (DECIDED) | Disruptive, can hit multiple rival squads that own the target at once — priced above Banker despite the self-risk of backfiring |
| Free Hit | 20 | Most flexible chip — a full one-week squad rebuild, comparable to FPL's highest-value chip |

**Note:** Bounty and Red Card prices are decided; Inflation, Bench Boost, Banker, and Free Hit remain starting estimates based on relative risk/impact, not simulated data. Worth revisiting after 2–3 live gameweeks once real point totals are visible.

**Chip usage limit (DECIDED):** a participant may play **at most 2 chips per gameweek**, regardless of type. Enforce this in the chip-purchase flow — reject a third purchase attempt in the same gameweek.

## 6. Random Boost (new mechanic, non-chip)
- Every gameweek, after the selection deadline passes, the system randomly selects **5 players** from clubs still active in the competition (not eliminated)
- Those 5 players' points are multiplied by **1.5x** for that gameweek, for every squad that owns them
- Selection must happen via a scheduled job that runs **after** `Gameweek.deadline`, using a server-side random selection (not client-visible in advance)

---

## 7. Knockout-Stage Transition
- League phase (8 gameweeks) → league standings computed → **redraft opens** (see Section 3.2 squad rules)
- Redraft window should have its own deadline (before Ro16 first leg kickoff − 1hr, following the same deadline logic as league-phase gameweeks)
- All chip and Random Boost mechanics carry over structurally into knockout gameweeks; fixture count per gameweek drops (2–4 matches typically), so the recurring API cost drops proportionally too

---

## 8. Data Source & API Integration

**Provider:** API-Football (API-Sports), free tier — 100 requests/day, 10 requests/minute, quota resets 00:00 UTC.

**Call plan:**
1. **One-time bulk fixture pull per stage** — single call (league + season filter, no date filter) to pull all league-phase fixtures (144 matches, all kickoff times) at competition start. Repeat once at knockout-stage start for the Ro16-onward fixture list.
2. **Deadlines computed locally** from kickoff times already stored — no separate API call.
3. **Per-gameweek recurring cost — 1 call per fixture, after full time**, to pull per-player stats (goals, assists, minutes, cards, CBIT). 18 fixtures/gameweek in league phase (~9/night across two nights).
4. **Nothing else calls the API.** Price recalculation, chip resolution, Random Boost selection, and standings are all computed from data already in the database.

**Total league-phase cost: ~145 calls across 8 gameweeks**, never exceeding ~10/day.

**Required scheduled jobs (Vercel Cron):**
- `pull-fixture-list` — run once per stage transition (manual trigger acceptable too, given low frequency)
- `pull-fixture-stats` — run per fixture shortly after its scheduled full-time (kickoff + ~2hrs, with retry logic in case a match runs long/into extra time)
- `compute-gameweek-points` — run after all of a gameweek's fixture stats are pulled; computes `PlayerGameweekPoints` from `PlayerGameweekStat`
- `resolve-chips` — run after gameweek points are computed; must apply effects in this exact order: (1) Red Card zeroing, (2) Banker 2x, (3) Random Boost 1.5x (see Section 6 — always last), (4) Bounty payouts, resolved using the raw base points for the `<4` threshold check but transferring final post-multiplier points, (5) Bench Boost, (6) Free Hit squad reversion, (7) apply any −4 extra-transfer penalties (Section 3.3) to the gameweek total
- `select-random-boost` — run once, strictly after `Gameweek.deadline` has passed, before points are finalized
- `recompute-prices` — run after gameweek points are finalized; applies the pricing formula (Section 9) per player

**Admin requirements:**
- Admin-only UI/route to manually edit any `PlayerGameweekStat` field, with a required reason logged to `AdminOverride`
- Manual override should trigger a recompute of dependent points/chips/prices for that gameweek

---

## 8a. Initial Player Price Seeding (DECIDED — source, implementation detail open)

**Source: UEFA's own official Fantasy game** (`gaming.uefa.com/en/uclfantasy/create-team`) — this already carries real UCL-specific fantasy prices for every eligible player, set by UEFA itself, which is a better fit than Transfermarkt market values (real-world transfer value ≠ fantasy price, and UEFA's own game prices are already balanced for a fantasy budget curve).

**Implementation note for Claude Code:** the URL above is a single-page app shell — fetching it directly returns only the page frame (nav, meta tags), not player data. The player/price data loads client-side from UEFA's internal JSON API after the page runs its JS. To get the actual data, Claude Code will need to:
1. Open the page in a headless browser (e.g. Playwright) and inspect the network requests it fires, to identify the underlying JSON API endpoint(s) the fantasy app itself calls for player lists and prices
2. Once identified, call that JSON endpoint directly (no need to keep running a headless browser after the endpoint is known, unless it requires session/auth tokens tied to page load)
3. This is an **unofficial use of UEFA's internal API** (no public docs) — fine for a private, non-commercial 10-person league, but flag if this matters, and be prepared for the endpoint or its shape to change without notice, since it's not a stable public contract
4. This is a **one-time pull per stage** (once for the league-phase draft, again when the knockout redraft opens) — not a recurring cost, and entirely separate from the API-Football budget in Section 8

**Do we need anything beyond the base price for the up/down calculation? No.** The Section 9 pricing formula only needs `Player.currentPrice` (to compute expected points) and that gameweek's `ActualPoints` (already being computed from API-Football stats) — both are already in the data model. No additional data source is needed for price movement; UEFA's site is only needed once, to seed the *starting* price.

## 9. Player Pricing Algorithm

Run once per gameweek, per player, after gameweek points are finalized:

```
EP(P)        = β × P                                    // expected points at current price
Δ(t)         = ActualPoints(t) − EP(P)                  // raw performance delta
Δ_smoothed(t)= λ × Δ(t) + (1 − λ) × Δ_smoothed(t−1)      // EMA smoothing across gameweeks
ΔPrice(t)    = clamp(γ × Δ_smoothed(t), −maxDrop, +maxRise)
P(t+1)       = clamp(P(t) + ΔPrice(t), floorPrice, ceilingPrice)
```

**Starting constants (need tuning via simulation before launch):**
- β ≈ 0.6–0.8, likely position-differentiated (lower for GK/DEF, higher for MID/ATT)
- λ ≈ 0.4–0.5
- γ ≈ 0.05 (tune against simulated data)
- maxDrop/maxRise ≈ 5% of current price per gameweek
- floorPrice/ceilingPrice ≈ 60%/180% of `Player.originalPrice`

**Before launch:** run this formula against a past UCL season's actual results (or FPL historical data as a proxy) to sanity-check constants against a few known star performers and known flops.

---

## 10. Non-Functional Requirements
- **API budget discipline is a hard constraint** — all API-Football calls must go through a single rate-limited client wrapper that logs daily usage and refuses calls beyond a safety margin (e.g. stop at 90/day) to avoid ever hitting the free-tier wall
- **Timezone handling** — all kickoff times and deadlines should be stored in UTC, displayed in each user's local time
- **Idempotency** — fixture-stats pulls and points computation jobs should be safely re-runnable (e.g. if a cron job retries) without double-counting
- **Auditability** — admin overrides must be logged with old/new values and a reason, never silently overwritten

---

## 11. Open Items Before Build
1. Confirm exact UEFA Fantasy internal API endpoint once identified by inspection (Section 8a)
2. Confirm whether knockout redraft budget is a hard reset or scales with league-phase performance
3. Confirm whether the 3-per-club limit carries into the knockout redraft
4. Tune and validate pricing formula constants via simulation

---

## 12. Suggested Build Order (for Claude Code)
1. Data model + Prisma schema + migrations
2. Auth + basic user/admin roles
3. League-phase draft UI + squad validation rules
4. Fixture ingestion (one-time bulk pull) + gameweek/deadline computation
5. Fixture-stats cron + scoring engine (Section 4)
6. Standings/leaderboard view
7. Chip purchase UI + chip resolution engine (Section 5)
8. Random Boost job (Section 6)
9. Pricing engine (Section 9)
10. Knockout redraft flow (Section 7)
11. Admin override panel (Section 8)
12. Polish/UI pass
