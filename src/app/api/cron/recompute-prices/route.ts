import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { recomputePrices } from "@/lib/pricing";
import type { Stage } from "@/generated/prisma/enums";

// Recompute player prices after a gameweek is finalized (PRD §9). Idempotent.
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
    const result = await recomputePrices(gw, stage);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
