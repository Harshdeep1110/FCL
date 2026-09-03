import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getStandings } from "@/lib/standings";

export const dynamic = "force-dynamic";

export default async function StandingsPage() {
  const user = await requireUser();
  const standings = await getStandings();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="flex items-center gap-3 border-b border-slate-800 px-6 py-4">
        <Link href="/" className="text-slate-400 hover:text-slate-200">
          ←
        </Link>
        <h1 className="text-xl font-bold">Standings</h1>
      </header>

      <section className="mx-auto max-w-2xl px-6 py-8">
        {standings.every((s) => s.gameweeksPlayed === 0) && (
          <p className="mb-4 text-sm text-slate-400">
            No gameweeks scored yet — the season hasn&apos;t started. Totals appear
            here once results come in.
          </p>
        )}
        <table className="w-full overflow-hidden rounded-lg border border-slate-800 text-sm">
          <thead className="bg-slate-900 text-left text-slate-400">
            <tr>
              <th className="px-4 py-2 w-12">#</th>
              <th className="px-4 py-2">Player</th>
              <th className="px-4 py-2 text-right">GWs</th>
              <th className="px-4 py-2 text-right">Points</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr
                key={row.userId}
                className={`border-t border-slate-800 ${
                  row.userId === user.id ? "bg-indigo-950/40" : ""
                }`}
              >
                <td className="px-4 py-2 font-mono text-slate-400">{row.rank}</td>
                <td className="px-4 py-2">
                  {row.name}
                  {row.userId === user.id && (
                    <span className="ml-2 text-xs text-indigo-400">you</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right text-slate-400">
                  {row.gameweeksPlayed}
                </td>
                <td className="px-4 py-2 text-right font-mono font-semibold">
                  {row.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
