import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { AdminPanel, type AdminPlayer } from "@/components/AdminPanel";
import { PageHeader } from "@/components/ui/PageHeader";

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
    <main className="flex min-h-screen flex-col">
      <PageHeader title="Admin — stat overrides" back="/" />

      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <AdminPanel
          gameweeks={gameweeks.map((g) => ({
            id: g.id,
            label: `${g.stage} GW${g.number}`,
          }))}
          players={adminPlayers}
        />

        <h2 className="mt-10 mb-3 text-lg font-semibold">Recent overrides</h2>
        {overrides.length === 0 ? (
          <p className="text-sm text-muted">No overrides logged yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {overrides.map((o) => (
              <li
                key={o.id}
                className="rounded-lg border border-border bg-surface/50 px-3 py-2"
              >
                <span className="text-muted">
                  {o.createdAt.toLocaleString()} · {o.admin.name ?? o.admin.email}
                </span>{" "}
                — <span className="font-mono">{o.fieldChanged}</span>:{" "}
                {o.oldValue} → {o.newValue}{" "}
                <span className="text-muted/70">({o.reason})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
