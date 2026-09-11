import { requireUser } from "@/lib/session";
import { getStandings } from "@/lib/standings";
import { PageHeader } from "@/components/ui/PageHeader";
import { StandingsTable } from "@/components/StandingsTable";

export const dynamic = "force-dynamic";

export default async function StandingsPage() {
  const user = await requireUser();
  const standings = await getStandings();

  return (
    <main className="flex min-h-screen flex-col">
      <PageHeader title="Standings" back="/" subtitle="League leaderboard" />

      <section className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        {standings.every((s) => s.gameweeksPlayed === 0) && (
          <p className="mb-4 rounded-xl border border-border bg-surface/60 p-3 text-sm text-muted">
            No gameweeks scored yet — the season hasn&apos;t started. Totals
            appear here once results come in.
          </p>
        )}
        <StandingsTable rows={standings} currentUserId={user.id} />
      </section>
    </main>
  );
}
