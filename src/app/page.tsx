import { requireUser } from "@/lib/session";
import { signOut } from "@/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Reveal } from "@/components/ui/motion";
import { HomeTiles, type NavTile } from "@/components/HomeTiles";

export default async function Home() {
  const user = await requireUser();

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const tiles: NavTile[] = [
    {
      href: "/draft",
      title: "Draft your squad",
      desc: "100M budget · 15 players",
      icon: "⚽",
      accent: "cyan",
    },
    {
      href: "/draft/knockout",
      title: "Knockout redraft",
      desc: "50M · 7 players · active clubs",
      icon: "🏆",
      accent: "blue",
    },
    {
      href: "/chips",
      title: "Black Market",
      desc: "Buy chips to boost or disrupt",
      icon: "🎴",
      accent: "magenta",
    },
    {
      href: "/standings",
      title: "Standings",
      desc: "League leaderboard",
      icon: "📊",
      accent: "violet",
    },
    ...(user.isAdmin
      ? [
          {
            href: "/admin",
            title: "Admin",
            desc: "Overrides & data controls",
            icon: "🛠️",
            accent: "cyan" as const,
          },
        ]
      : []),
  ];

  return (
    <main className="flex min-h-screen flex-col">
      <PageHeader
        title="UCL Fantasy"
        right={
          <div className="flex items-center gap-3">
            <span className="hidden text-muted sm:inline">
              {user.name ?? user.email}
            </span>
            {user.isAdmin && (
              <span className="rounded bg-ucl-blue/20 px-2 py-0.5 text-xs text-ucl-cyan">
                admin
              </span>
            )}
            <form action={handleSignOut}>
              <button
                type="submit"
                className="rounded-md border border-border px-3 py-1.5 text-foreground transition hover:border-ucl-cyan hover:text-ucl-cyan"
              >
                Sign out
              </button>
            </form>
          </div>
        }
      />

      <section className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-14">
        <Reveal>
          <h2 className="mb-2 text-3xl font-bold sm:text-4xl">
            Welcome back <span className="inline-block animate-[pop_0.5s_ease]">👋</span>
          </h2>
          <p className="mb-10 max-w-lg text-muted">
            The season hub — pick your XI on the pitch, work the Black Market,
            and climb the table.
          </p>
        </Reveal>

        <HomeTiles tiles={tiles} />
      </section>
    </main>
  );
}
