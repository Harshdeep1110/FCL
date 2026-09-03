import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { ingestUefaSeason } from "@/lib/uefa";

// Refresh UEFA static data (clubs, players, prices, gameweeks, fixtures,
// elimination). Idempotent upserts — safe to run on a schedule. No API-Football
// quota used. Does NOT wipe; the reset is a manual dev operation (script).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const unauthorized = checkCronAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const result = await ingestUefaSeason();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
