import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { ingestGameweekStats } from "@/lib/stats";

// Pull per-player stats for a league gameweek from UEFA feeds (PRD §8).
// Idempotent; safe to retry. No API-Football quota used.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const unauthorized = checkCronAuth(req);
  if (unauthorized) return unauthorized;

  const gw = Number(new URL(req.url).searchParams.get("gw"));
  if (!gw || gw < 1) {
    return NextResponse.json(
      { ok: false, error: "Missing/invalid ?gw=<matchday>" },
      { status: 400 },
    );
  }

  try {
    const result = await ingestGameweekStats(gw);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
