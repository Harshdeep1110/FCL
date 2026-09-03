import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { DraftBoard, type PoolPlayer } from "@/components/DraftBoard";

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
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-slate-200">
            ←
          </Link>
          <h1 className="text-xl font-bold">Draft your squad</h1>
        </div>
        <span className="text-sm text-slate-400">League phase</span>
      </header>

      <DraftBoard
        pool={pool}
        initialSelection={initialSelection}
        stage="LEAGUE"
      />
    </main>
  );
}
