import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { DraftBoard, type PoolPlayer } from "@/components/DraftBoard";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function DraftPage() {
  const user = await requireUser();

  const [players, squad] = await Promise.all([
    prisma.player.findMany({
      include: { club: { select: { id: true, name: true } } },
      orderBy: [{ position: "asc" }, { currentPrice: "desc" }],
    }),
    prisma.squad.findUnique({
      where: { userId_stage: { userId: user.id, stage: "LEAGUE" } },
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

  return (
    <main className="flex min-h-screen flex-col">
      <PageHeader
        title="Draft your squad"
        back="/"
        subtitle="League phase · 100M · 15 players"
        right={<span className="hidden sm:inline">League phase</span>}
      />

      <DraftBoard
        pool={pool}
        initialSelection={initialSelection}
        stage="LEAGUE"
      />
    </main>
  );
}
