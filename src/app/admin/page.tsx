import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { AdminPanel, type AdminPlayer } from "@/components/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();

  const [gameweeks, players, overrides] = await Promise.all([
    prisma.gameweek.findMany({
      orderBy: [{ stage: "asc" }, { number: "asc" }],
      select: { id: true, number: true, stage: true },
    }),
    prisma.player.findMany({
      select: { id: true, name: true, position: true, club: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.adminOverride.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { admin: { select: { name: true, email: true } } },
    }),
  ]);

  const adminPlayers: AdminPlayer[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    clubName: p.club.name,
  }));

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="flex items-center gap-3 border-b border-slate-800 px-6 py-4">
        <Link href="/" className="text-slate-400 hover:text-slate-200">
          ←
        </Link>
        <h1 className="text-xl font-bold">Admin — stat overrides</h1>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <AdminPanel
          gameweeks={gameweeks.map((g) => ({
            id: g.id,
            label: `${g.stage} GW${g.number}`,
          }))}
          players={adminPlayers}
        />

        <h2 className="mt-10 mb-3 text-lg font-semibold">Recent overrides</h2>
        {overrides.length === 0 ? (
          <p className="text-sm text-slate-500">No overrides logged yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {overrides.map((o) => (
              <li
                key={o.id}
                className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2"
              >
                <span className="text-slate-400">
                  {o.createdAt.toLocaleString()} · {o.admin.name ?? o.admin.email}
                </span>{" "}
                — <span className="font-mono">{o.fieldChanged}</span>:{" "}
                {o.oldValue} → {o.newValue}{" "}
                <span className="text-slate-500">({o.reason})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
