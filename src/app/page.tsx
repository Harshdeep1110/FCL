import Link from "next/link";
import { requireUser } from "@/lib/session";
import { signOut } from "@/auth";

export default async function Home() {
  const user = await requireUser();

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <h1 className="text-xl font-bold">UCL Fantasy</h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-400">
            {user.name ?? user.email}
            {user.isAdmin && (
              <span className="ml-2 rounded bg-indigo-600/30 px-2 py-0.5 text-xs text-indigo-300">
                admin
              </span>
            )}
          </span>
          <form action={handleSignOut}>
            <button
              type="submit"
              className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-300 transition hover:bg-slate-800"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-12">
        <h2 className="mb-2 text-2xl font-semibold">Welcome back 👋</h2>
        <p className="mb-8 text-slate-400">
          The season hub. Draft, chips, and standings land here as they&apos;re
          built.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/draft"
            className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 transition hover:border-indigo-600"
          >
            <div className="font-medium">Draft your squad</div>
            <div className="text-sm text-slate-400">
              100M budget · 15 players
            </div>
          </Link>
          <Link
            href="/draft/knockout"
            className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 transition hover:border-indigo-600"
          >
            <div className="font-medium">Knockout redraft</div>
            <div className="text-sm text-slate-400">50M · 7 players · active clubs</div>
          </Link>
          <Link
            href="/chips"
            className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 transition hover:border-indigo-600"
          >
            <div className="font-medium">Black Market</div>
            <div className="text-sm text-slate-400">Buy chips to boost or disrupt</div>
          </Link>
          <Link
            href="/standings"
            className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 transition hover:border-indigo-600"
          >
            <div className="font-medium">Standings</div>
            <div className="text-sm text-slate-400">League leaderboard</div>
          </Link>
          {user.isAdmin && (
            <Link
              href="/admin"
              className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 transition hover:border-indigo-600"
            >
              <div className="font-medium">Admin</div>
              <div className="text-sm text-slate-400">
                Overrides & data controls
              </div>
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
