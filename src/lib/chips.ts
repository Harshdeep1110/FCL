import { prisma } from "@/lib/prisma";
import { CHIP_COST, CHIP_RULES, CHIP_TARGET } from "@/lib/config";
import type { ChipType } from "@/generated/prisma/enums";

export interface BuyChipParams {
  userId: string;
  chipType: ChipType;
  gameweekId: string;
  targetPlayerId?: number | null;
  targetClubId?: string | null;
}

export type BuyChipResult = { ok: true } | { ok: false; error: string };

/** A user's cumulative running-points total across resolved gameweeks. */
export async function runningTotal(userId: string): Promise<number> {
  const agg = await prisma.userGameweekScore.aggregate({
    where: { userId },
    _sum: { total: true },
  });
  return agg._sum.total ?? 0;
}

/**
 * Purchase a chip (PRD §5, §5a). Enforces: deadline not passed, max 2 chips
 * per gameweek, first chip free then costs points, affordability, and target
 * requirements. Inflation applies its market-wide price effect immediately.
 */
export async function buyChip(params: BuyChipParams): Promise<BuyChipResult> {
  const { userId, chipType, gameweekId, targetPlayerId, targetClubId } = params;

  const gw = await prisma.gameweek.findUnique({ where: { id: gameweekId } });
  if (!gw) return { ok: false, error: "Gameweek not found." };
  if (gw.locked || gw.deadline.getTime() <= Date.now())
    return { ok: false, error: "The deadline for this gameweek has passed." };

  // Max chips per gameweek.
  const usedThisGw = await prisma.chipPurchase.count({
    where: { userId, gameweekId },
  });
  if (usedThisGw >= CHIP_RULES.maxChipsPerGameweek)
    return {
      ok: false,
      error: `Max ${CHIP_RULES.maxChipsPerGameweek} chips per gameweek.`,
    };

  // Target validation.
  const need = CHIP_TARGET[chipType];
  if (need === "PLAYER") {
    if (!targetPlayerId) return { ok: false, error: "Pick a target player." };
    const p = await prisma.player.findUnique({ where: { id: targetPlayerId } });
    if (!p) return { ok: false, error: "Target player not found." };
  } else if (need === "CLUB") {
    if (!targetClubId) return { ok: false, error: "Pick a target club." };
    const c = await prisma.club.findUnique({ where: { id: targetClubId } });
    if (!c) return { ok: false, error: "Target club not found." };
  }

  // First chip is free; subsequent ones cost points.
  const totalChipsEver = await prisma.chipPurchase.count({ where: { userId } });
  const isFree = totalChipsEver < CHIP_RULES.freeChipsPerUser;
  const cost = isFree ? 0 : CHIP_COST[chipType];

  if (cost > 0) {
    const [total, committed] = await Promise.all([
      runningTotal(userId),
      prisma.chipPurchase.aggregate({
        where: { userId, gameweekId },
        _sum: { pointsCost: true },
      }),
    ]);
    const available = total - (committed._sum.pointsCost ?? 0);
    if (available < cost)
      return {
        ok: false,
        error: `Not enough points: ${chipType} costs ${cost}, you have ${available.toFixed(0)}.`,
      };
  }

  await prisma.$transaction(async (tx) => {
    await tx.chipPurchase.create({
      data: {
        userId,
        chipType,
        gameweekId,
        pointsCost: cost,
        isFree,
        targetPlayerId: need === "PLAYER" ? targetPlayerId : null,
        targetClubId: need === "CLUB" ? targetClubId : null,
      },
    });

    // Inflation: raise the target club's player prices by 10% for everyone.
    if (chipType === "INFLATION" && targetClubId) {
      const clubPlayers = await tx.player.findMany({
        where: { clubId: targetClubId },
        select: { id: true, currentPrice: true },
      });
      for (const p of clubPlayers) {
        const raised = Math.round(p.currentPrice * (1 + CHIP_RULES.inflationPct) * 10) / 10;
        await tx.player.update({
          where: { id: p.id },
          data: { currentPrice: raised },
        });
      }
    }
  });

  return { ok: true };
}
