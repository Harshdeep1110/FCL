import { prisma } from "@/lib/prisma";
import { PRICING } from "@/lib/config";
import type { Position, Stage } from "@/generated/prisma/enums";

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
const round1 = (x: number) => Math.round(x * 10) / 10;

export interface PriceInputs {
  actualPoints: number;
  currentPrice: number;
  originalPrice: number;
  position: Position;
  /** EMA-smoothed delta carried from the previous gameweek (0 to start). */
  prevSmoothedDelta: number;
}

export interface PriceOutput {
  newPrice: number;
  rawDelta: number;
  smoothedDelta: number;
  priceDelta: number;
}

/**
 * Player price movement for one gameweek (PRD §9). Pure.
 *
 *   EP        = β × P
 *   Δ         = ActualPoints − EP
 *   Δ_smooth  = λΔ + (1−λ)Δ_prev            (EMA across gameweeks)
 *   ΔPrice    = clamp(γ·Δ_smooth, ±maxMove) (maxMove = 5% of current price)
 *   P(t+1)    = clamp(P + ΔPrice, floor, ceiling)  (60%..180% of original)
 */
export function computeNewPrice(i: PriceInputs): PriceOutput {
  const beta = PRICING.beta[i.position];
  const ep = beta * i.currentPrice;
  const rawDelta = i.actualPoints - ep;
  const smoothed =
    PRICING.lambda * rawDelta + (1 - PRICING.lambda) * i.prevSmoothedDelta;

  const maxMove = PRICING.maxMovePct * i.currentPrice;
  const priceMove = clamp(PRICING.gamma * smoothed, -maxMove, maxMove);

  const floor = PRICING.floorPct * i.originalPrice;
  const ceiling = PRICING.ceilingPct * i.originalPrice;
  const newPrice = round1(clamp(i.currentPrice + priceMove, floor, ceiling));

  return {
    newPrice,
    rawDelta,
    smoothedDelta: smoothed,
    priceDelta: round1(newPrice - i.currentPrice),
  };
}

export interface RecomputeResult {
  gameweek: number;
  playersRepriced: number;
}

/**
 * Recompute every active player's price after a gameweek is finalized (PRD §9),
 * recording PriceHistory (with the smoothed delta for the next EMA step) and
 * updating Player.currentPrice. Idempotent for a given gameweek.
 */
export async function recomputePrices(
  gwNumber: number,
  stage: Stage = "LEAGUE",
): Promise<RecomputeResult> {
  const gw = await prisma.gameweek.findUnique({
    where: { number_stage: { number: gwNumber, stage } },
  });
  if (!gw) throw new Error(`Gameweek ${gwNumber} (${stage}) not found.`);

  const prevGw = await prisma.gameweek.findUnique({
    where: { number_stage: { number: gwNumber - 1, stage } },
  });
  const prevHistory = prevGw
    ? await prisma.priceHistory.findMany({
        where: { gameweekId: prevGw.id },
        select: { playerId: true, smoothedDelta: true },
      })
    : [];
  const prevSmoothed = new Map(
    prevHistory.map((h) => [h.playerId, h.smoothedDelta]),
  );

  const [players, points] = await Promise.all([
    prisma.player.findMany({
      where: { club: { eliminated: false } },
      select: { id: true, position: true, currentPrice: true, originalPrice: true },
    }),
    prisma.playerGameweekPoints.findMany({
      where: { gameweekId: gw.id },
      select: { playerId: true, basePoints: true },
    }),
  ]);
  const pointsByPlayer = new Map(points.map((p) => [p.playerId, p.basePoints]));

  let repriced = 0;
  for (const p of players) {
    const out = computeNewPrice({
      actualPoints: pointsByPlayer.get(p.id) ?? 0,
      currentPrice: p.currentPrice,
      originalPrice: p.originalPrice,
      position: p.position,
      prevSmoothedDelta: prevSmoothed.get(p.id) ?? 0,
    });

    // No per-player transaction: the op is idempotent, and 994 interactive
    // transactions over the Neon adapter hit P2028 timeouts. A partial run is
    // safely fixed by re-running (upserts are stable).
    await prisma.priceHistory.upsert({
      where: { playerId_gameweekId: { playerId: p.id, gameweekId: gw.id } },
      create: {
        playerId: p.id,
        gameweekId: gw.id,
        priceBefore: p.currentPrice,
        priceAfter: out.newPrice,
        rawDelta: out.rawDelta,
        smoothedDelta: out.smoothedDelta,
      },
      update: {
        priceBefore: p.currentPrice,
        priceAfter: out.newPrice,
        rawDelta: out.rawDelta,
        smoothedDelta: out.smoothedDelta,
      },
    });
    await prisma.player.update({
      where: { id: p.id },
      data: { currentPrice: out.newPrice },
    });
    repriced += 1;
  }

  await prisma.gameweek.update({
    where: { id: gw.id },
    data: { pricesRecomputed: true },
  });

  return { gameweek: gwNumber, playersRepriced: repriced };
}
