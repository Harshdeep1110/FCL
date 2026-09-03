import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { computeGameweekPoints } from "@/lib/stats";

// Compute base fantasy points for a gameweek from its stat lines (PRD §4/§8).
// Runs after pull-fixture-stats. Idempotent.
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
    const result = await computeGameweekPoints(gw);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
