"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { buyChip, type BuyChipResult } from "@/lib/chips";

const schema = z.object({
  chipType: z.enum([
    "RED_CARD",
    "BANKER",
    "INFLATION",
    "BENCH_BOOST",
    "BOUNTY",
    "FREE_HIT",
  ]),
  gameweekId: z.string().min(1),
  targetPlayerId: z.number().int().positive().nullable().optional(),
  targetClubId: z.string().nullable().optional(),
});

export async function buyChipAction(input: unknown): Promise<BuyChipResult> {
  const user = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const result = await buyChip({
    userId: user.id,
    chipType: parsed.data.chipType,
    gameweekId: parsed.data.gameweekId,
    targetPlayerId: parsed.data.targetPlayerId ?? null,
    targetClubId: parsed.data.targetClubId ?? null,
  });

  if (result.ok) revalidatePath("/chips");
  return result;
}
