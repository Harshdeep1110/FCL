"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { SQUAD_RULES } from "@/lib/config";
import { validateSquad, type DraftEntry } from "@/lib/squad-validation";
import type { SquadStage } from "@/generated/prisma/enums";

const entrySchema = z.object({
  playerId: z.number().int().positive(),
  isStarting: z.boolean(),
  isCaptain: z.boolean(),
});

const payloadSchema = z.object({
  stage: z.enum(["LEAGUE", "KNOCKOUT"]),
  entries: z.array(entrySchema).min(1).max(15),
});

export type SaveDraftResult = { ok: true } | { ok: false; errors: string[] };

export async function saveDraft(input: unknown): Promise<SaveDraftResult> {
  const user = await requireUser();

  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: ["Invalid submission."] };
  }
  const { stage, entries } = parsed.data;

  // Re-fetch authoritative player data from the DB — never trust client prices.
  const ids = entries.map((e) => e.playerId);
  const players = await prisma.player.findMany({
    where: { id: { in: ids } },
    select: { id: true, position: true, currentPrice: true, clubId: true },
  });
  if (players.length !== ids.length) {
    return { ok: false, errors: ["One or more selected players no longer exist."] };
  }
  const byId = new Map(players.map((p) => [p.id, p]));

  const draftEntries: DraftEntry[] = entries.map((e) => {
    const p = byId.get(e.playerId)!;
    return {
      playerId: e.playerId,
      position: p.position,
      price: p.currentPrice,
      clubId: p.clubId,
      isStarting: e.isStarting,
      isCaptain: e.isCaptain,
    };
  });

  const result = validateSquad(draftEntries, stage as SquadStage);
  if (!result.ok) return { ok: false, errors: result.errors };

  const rules = SQUAD_RULES[stage as SquadStage];

  // Upsert the squad, then replace its players atomically.
  const squad = await prisma.squad.upsert({
    where: { userId_stage: { userId: user.id, stage: stage as SquadStage } },
    create: {
      userId: user.id,
      stage: stage as SquadStage,
      budget: rules.budget,
      budgetSpent: result.summary.budgetSpent,
    },
    update: { budgetSpent: result.summary.budgetSpent },
  });

  await prisma.$transaction([
    prisma.squadPlayer.deleteMany({ where: { squadId: squad.id } }),
    prisma.squadPlayer.createMany({
      data: draftEntries.map((e) => ({
        squadId: squad.id,
        playerId: e.playerId,
        isStarting: e.isStarting,
        isCaptain: e.isCaptain,
        priceAtDraft: e.price,
      })),
    }),
  ]);

  revalidatePath("/draft");
  return { ok: true };
}
