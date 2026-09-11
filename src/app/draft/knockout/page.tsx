import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { DraftBoard, type PoolPlayer } from "@/components/DraftBoard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SQUAD_RULES } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Knockout redraft (PRD §7): fresh 50M / 7-player squad, drawn only from clubs
 * still active in the competition. Opens once the league phase is complete.
 */
export default async function KnockoutDraftPage() {
  const user = await requireUser();

  // Redraft opens when every league gameweek has been resolved.
  const leagueGws = await prisma.gameweek.findMany({
    where: { stage: "LEAGUE" },
    select: { chipsResolved: true },
  });
  const leaguePhaseDone =
    leagueGws.length > 0 && leagueGws.every((g) => g.chipsResolved);

  const [players, squad] = await Promise.all([
    prisma.player.findMany({
      where: { club: { eliminated: false } },
      include: { club: { select: { id: true, name: true } } },
      orderBy: [{ position: "asc" }, { currentPrice: "desc" }],
    }),
    prisma.squad.findUnique({
      where: { userId_stage: { userId: user.id, stage: "KNOCKOUT" } },
      include: { players: true },
    }),
  ]);

  const pool: PoolPlayer[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    price: p.currentPrice,
    clubId: p.club.id,
    clubName: p.club.name,
  }));

  const initialSelection = (squad?.players ?? []).map((sp) => ({
    playerId: sp.playerId,
    isStarting: sp.isStarting,
    isCaptain: sp.isCaptain,
  }));

  const rules = SQUAD_RULES.KNOCKOUT;

  return (
    <main className="flex min-h-screen flex-col">
      <PageHeader
        title="Knockout redraft"
        back="/"
        subtitle={`${rules.budget}M · ${rules.squadSize} players · active clubs only`}
      />

      {!leaguePhaseDone && (
        <p className="mx-3 mt-4 rounded-xl border border-warn/30 bg-warn/10 p-3 text-sm text-warn sm:mx-6">
          The knockout redraft opens once the league phase is complete. You can
          preview and build a squad now, but it&apos;s only official after the
          league phase ends.
        </p>
      )}

      <DraftBoard pool={pool} initialSelection={initialSelection} stage="KNOCKOUT" />
    </main>
  );
}
