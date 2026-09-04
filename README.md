# UCL Fantasy League

A private, invite-only fantasy football web app for the UEFA Champions League
(~10 participants). Draft a squad under a budget cap, set a weekly XI, earn
points from real player performances, and buy "black market" chips to boost
yourself or disrupt rivals. See [`ucl-fantasy-prd.md`](./ucl-fantasy-prd.md) for
the full product spec.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** + **Tailwind v4**
- **Prisma 7** on **Neon Postgres** (Neon serverless driver adapter)
- **Auth.js v5** credentials login (invite-only), edge-safe route protection
- **Vercel** deploy + Cron jobs

## Data source

Player prices, stats, fixtures, and club-elimination status come from **UEFA's
own fantasy feeds** (free, current-season 2026/27). API-Football is kept as a
dormant alternate (its free tier only covers seasons 2022–2024). UEFA exposes
`balls recovered` rather than raw CBIT, so the defensive-contributions points use
balls-recovered thresholds (`src/lib/config.ts`, tunable).

## Local setup

```bash
npm install                      # also runs `prisma generate`
cp .env.example .env             # fill in the values below
npm run db:deploy                # apply migrations to your Neon DB
npm run ingest:uefa              # pull real UEFA clubs/players/fixtures/prices
npm run create-user you@email.com yourpassword "Your Name" --admin
npm run dev                      # http://localhost:3000
```

### Environment variables (`.env`)

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Neon **pooled** connection string |
| `AUTH_SECRET` | Auth.js secret (`npx auth secret` or `openssl rand -base64 32`) |
| `CRON_SECRET` | Bearer token protecting `/api/cron/*` |
| `UEFA_FEED_ID` | UEFA season feed id (`90` = 2026/27) |
| `API_FOOTBALL_KEY` | Optional — only for the API-Football alternate |

## Tunable game rules

All scoring values, chip prices, squad rules, pricing coefficients and
thresholds live in [`src/lib/config.ts`](./src/lib/config.ts) — change and
redeploy, no migration needed.

## Testing

```bash
npm run test:all   # scoring, resolution (chips), pricing, stat-diff engines
```

The engines are pure functions with assertion suites, including the PRD's exact
worked Bounty example.

## The scoring pipeline (crons)

Each `/api/cron/*` route is protected by `CRON_SECRET`
(`Authorization: Bearer <CRON_SECRET>`). The orchestrator runs them in order:

1. `select-random-boost` — after the deadline, pick 5 boosted players
2. `lock-gameweek` — snapshot every squad into a locked lineup
3. `pull-fixture-stats` — per-player stats from UEFA (diffs matchday feeds)
4. `compute-gameweek-points` — base points per PRD §4
5. `resolve-chips` — Red Card → captain/Banker ×2 → Boost ×1.5 → Bounty →
   Bench Boost → transfer penalties (PRD §8 order)
6. `recompute-prices` — EMA price movement, once all fixtures finish

`/api/cron/tick` runs the whole sequence idempotently for the current gameweek
(so a single fixed-path Vercel Cron drives everything). Any step is safely
re-runnable. Individual routes accept `?gw=<n>&stage=<STAGE>` for manual runs.

## Deploy (Vercel)

1. Import the repo into Vercel.
2. Set the env vars above in Project Settings (Production).
3. Deploy. The build runs `prisma generate && next build`.
4. Run `npm run db:deploy` against the production DB (or from CI).
5. Crons are configured in [`vercel.json`](./vercel.json): `tick` daily,
   UEFA refresh weekly. Setting `CRON_SECRET` makes Vercel send it as the
   Bearer token automatically.

## Admin

Admin users get `/admin` — edit any player's stat line for a gameweek with a
required, logged reason; points recompute automatically (re-run `resolve-chips`
to cascade). Create admins with the `--admin` flag on `create-user`.
