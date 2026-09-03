import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { resolveGameweekPersisted } from "@/lib/resolve-gameweek";
import type { Stage } from "@/generated/prisma/enums";

// Resolve a gameweek's chips + scoring into UserGameweekScore (PRD §8).
// Run after compute-gameweek-points and select-random-boost. Idempotent.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const unauthorized = checkCronAuth(req);
  if (unauthorized) return unauthorized;

  const url = new URL(req.url);
  const gw = Number(url.searchParams.get("gw"));
  const stage = (url.searchParams.get("stage") ?? "LEAGUE") as Stage;
  if (!gw || gw < 1)
    return NextResponse.json({ ok: false, error: "Missing/invalid ?gw" }, { status: 400 });

  try {
    const result = await resolveGameweekPersisted(gw, stage);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
