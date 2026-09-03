import { NextResponse } from "next/server";

/**
 * Validate a cron/admin request. Vercel Cron sends
 * `Authorization: Bearer <CRON_SECRET>`. Returns a 401 response if invalid,
 * otherwise null (proceed).
 */
export function checkCronAuth(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 500 },
    );
  }
  const header = req.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
