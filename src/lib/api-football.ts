import { prisma } from "@/lib/prisma";
import { API_FOOTBALL } from "@/lib/config";

const BASE_URL = "https://v3.football.api-sports.io";

/** Thrown when a call would exceed the self-imposed daily safety cap. */
export class ApiBudgetError extends Error {
  constructor(used: number) {
    super(
      `API-Football daily safety cap reached (${used}/${API_FOOTBALL.dailySafetyCap}). ` +
        `Refusing further calls today to protect the free-tier quota.`,
    );
    this.name = "ApiBudgetError";
  }
}

/** API-Sports envelope shape. */
export interface ApiFootballResponse<T> {
  get: string;
  parameters: Record<string, string>;
  errors: unknown;
  results: number;
  paging: { current: number; total: number };
  response: T[];
}

/** Start of the current UTC day — quota resets at 00:00 UTC. */
function startOfUtcDay(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/** How many metered calls we've logged so far today (UTC). */
export async function callsUsedToday(): Promise<number> {
  return prisma.apiCallLog.count({
    where: { calledAt: { gte: startOfUtcDay() } },
  });
}

// In-process throttle so a single batch job (e.g. stats pull) stays under the
// per-minute limit. Serverless cron jobs run sequentially, so this is enough.
let lastCallAt = 0;
const MIN_GAP_MS = Math.ceil(60_000 / API_FOOTBALL.perMinuteLimit);

async function throttle() {
  const wait = lastCallAt + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

interface GetOptions {
  /** Count this call against the daily cap + log it. /status is free → false. */
  meter?: boolean;
}

/**
 * Rate-limited GET against API-Football. Enforces the daily safety cap, spaces
 * calls to respect the per-minute limit, and logs every metered call.
 */
export async function apiFootballGet<T>(
  endpoint: string,
  params: Record<string, string | number> = {},
  { meter = true }: GetOptions = {},
): Promise<ApiFootballResponse<T>> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not set.");

  if (meter) {
    const used = await callsUsedToday();
    if (used >= API_FOOTBALL.dailySafetyCap) throw new ApiBudgetError(used);
  }

  await throttle();

  const url = new URL(`${BASE_URL}${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  let ok = true;
  let note: string | null = null;
  try {
    const res = await fetch(url, { headers: { "x-apisports-key": key } });
    const json = (await res.json()) as ApiFootballResponse<T>;

    // API-Sports returns 200 with an `errors` object on logical failures.
    const errs = json.errors;
    const hasErrors = Array.isArray(errs)
      ? errs.length > 0
      : errs && typeof errs === "object" && Object.keys(errs).length > 0;
    if (!res.ok || hasErrors) {
      ok = false;
      note = JSON.stringify(errs ?? res.statusText).slice(0, 500);
    }
    return json;
  } catch (e) {
    ok = false;
    note = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    if (meter) {
      await prisma.apiCallLog.create({
        data: { endpoint, success: ok, note },
      });
    }
  }
}

/** Free (unmetered) account/quota status. */
export async function apiFootballStatus() {
  return apiFootballGet<never>("/status", {}, { meter: false });
}
