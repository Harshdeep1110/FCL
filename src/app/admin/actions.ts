"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { computeGameweekPoints } from "@/lib/stats";

/** Editable stat fields (subset of PlayerGameweekStat). */
export const STAT_FIELDS = [
  "minutesPlayed",
  "goals",
  "assists",
  "goalsConceded",
  "saves",
  "penaltiesSaved",
  "penaltiesMissed",
  "yellowCards",
  "redCards",
  "ownGoals",
  "ballsRecovered",
] as const;
export type StatField = (typeof STAT_FIELDS)[number];

export interface StatValues {
  cleanSheet: boolean;
  minutesPlayed: number;
  goals: number;
  assists: number;
  goalsConceded: number;
  saves: number;
  penaltiesSaved: number;
  penaltiesMissed: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  ballsRecovered: number;
}

const ZERO: StatValues = {
  cleanSheet: false,
  minutesPlayed: 0,
  goals: 0,
  assists: 0,
  goalsConceded: 0,
  saves: 0,
  penaltiesSaved: 0,
  penaltiesMissed: 0,
  yellowCards: 0,
  redCards: 0,
  ownGoals: 0,
  ballsRecovered: 0,
};

/** Load a player's current stat line for a gameweek (admin only). */
export async function getStat(
  playerId: number,
  gameweekId: string,
): Promise<StatValues> {
  await requireAdmin();
  const stat = await prisma.playerGameweekStat.findUnique({
    where: { playerId_gameweekId: { playerId, gameweekId } },
  });
  if (!stat) return { ...ZERO };
  return {
    cleanSheet: stat.cleanSheet,
    minutesPlayed: stat.minutesPlayed,
    goals: stat.goals,
    assists: stat.assists,
    goalsConceded: stat.goalsConceded,
    saves: stat.saves,
    penaltiesSaved: stat.penaltiesSaved,
    penaltiesMissed: stat.penaltiesMissed,
    yellowCards: stat.yellowCards,
    redCards: stat.redCards,
    ownGoals: stat.ownGoals,
    ballsRecovered: stat.ballsRecovered,
  };
}

const saveSchema = z.object({
  playerId: z.number().int().positive(),
  gameweekId: z.string().min(1),
  reason: z.string().trim().min(3, "A reason is required."),
  values: z.object({
    cleanSheet: z.boolean(),
    minutesPlayed: z.number().int().min(0),
    goals: z.number().int().min(0),
    assists: z.number().int().min(0),
    goalsConceded: z.number().int().min(0),
    saves: z.number().int().min(0),
    penaltiesSaved: z.number().int().min(0),
    penaltiesMissed: z.number().int().min(0),
    yellowCards: z.number().int().min(0),
    redCards: z.number().int().min(0),
    ownGoals: z.number().int().min(0),
    ballsRecovered: z.number().int().min(0),
  }),
});

export type SaveStatResult =
  | { ok: true; changes: number; recomputed: number }
  | { ok: false; error: string };

/**
 * Override a player's stat line for a gameweek (PRD §8 admin requirements):
 * log every changed field to AdminOverride with a reason, upsert the stat, then
 * recompute that gameweek's points. Re-run resolve-chips afterward to cascade.
 */
export async function saveStatOverride(input: unknown): Promise<SaveStatResult> {
  const admin = await requireAdmin();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { playerId, gameweekId, reason, values } = parsed.data;

  const gw = await prisma.gameweek.findUnique({ where: { id: gameweekId } });
  if (!gw) return { ok: false, error: "Gameweek not found." };

  const existing = await getStat(playerId, gameweekId);

  // Diff each field for the audit log.
  const changes: { field: string; oldValue: string; newValue: string }[] = [];
  for (const key of Object.keys(values) as (keyof StatValues)[]) {
    if (existing[key] !== values[key]) {
      changes.push({
        field: key,
        oldValue: String(existing[key]),
        newValue: String(values[key]),
      });
    }
  }
  if (changes.length === 0) return { ok: false, error: "No changes to save." };

  await prisma.playerGameweekStat.upsert({
    where: { playerId_gameweekId: { playerId, gameweekId } },
    create: { playerId, gameweekId, ...values },
    update: { ...values },
  });

  await prisma.adminOverride.createMany({
    data: changes.map((c) => ({
      adminUserId: admin.id,
      targetType: "PLAYER_GAMEWEEK_STAT" as const,
      targetId: `${playerId}:${gameweekId}`,
      fieldChanged: c.field,
      oldValue: c.oldValue,
      newValue: c.newValue,
      reason,
    })),
  });

  // Recompute dependent points for the gameweek.
  const recompute = await computeGameweekPoints(gw.number, gw.stage);

  revalidatePath("/admin");
  return { ok: true, changes: changes.length, recomputed: recompute.playersScored };
}
