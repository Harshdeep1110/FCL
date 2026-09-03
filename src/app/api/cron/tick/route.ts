import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { currentGameweek, allFixturesFinished } from "@/lib/gameweek";
import { selectRandomBoost } from "@/lib/random-boost";
import { lockGameweek } from "@/lib/lineup";
import { ingestGameweekStats, computeGameweekPoints } from "@/lib/stats";
import { resolveGameweekPersisted } from "@/lib/resolve-gameweek";
import { recomputePrices } from "@/lib/pricing";

/**
 * Orchestrator cron (PRD §8): runs the full post-deadline pipeline for the
 * current gameweek in the correct order, each step idempotent. Designed for a
 * fixed-path Vercel Cron (no ?gw needed). Safe to run repeatedly — stats/points/
 * resolution converge as matches finish; prices only finalize once all matches
 * are FINISHED.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const unauthorized = checkCronAuth(req);
  if (unauthorized) return unauthorized;

  const gw = await currentGameweek("LEAGUE");
  if (!gw) return NextResponse.json({ ok: true, note: "No active gameweek." });

  const steps: Record<string, unknown> = {};
  try {
    if (!gw.randomBoostSelected)
      steps.randomBoost = await selectRandomBoost(gw.number, gw.stage);
    if (!gw.locked) steps.lock = await lockGameweek(gw.number, gw.stage);

    steps.stats = await ingestGameweekStats(gw.number, gw.stage);
    steps.points = await computeGameweekPoints(gw.number, gw.stage);
    steps.resolve = await resolveGameweekPersisted(gw.number, gw.stage);

    // Prices finalize once, after every fixture has finished.
    if (!gw.pricesRecomputed && (await allFixturesFinished(gw.id)))
      steps.prices = await recomputePrices(gw.number, gw.stage);

    return NextResponse.json({ ok: true, gameweek: gw.number, steps });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, gameweek: gw.number, steps, error: message },
      { status: 500 },
    );
  }
}
