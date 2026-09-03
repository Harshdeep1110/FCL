import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { ingestUclFixtures } from "@/lib/ingest";

// One-time bulk fixture pull per stage/season (PRD §8). Low frequency; a manual
// trigger is acceptable. Costs one API-Football call.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const unauthorized = checkCronAuth(req);
  if (unauthorized) return unauthorized;

  const url = new URL(req.url);
  const season = Number(
    url.searchParams.get("season") ?? process.env.UCL_SEASON ?? "2024",
  );

  try {
    const result = await ingestUclFixtures(season);
    return NextResponse.json({ ok: true, season, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
