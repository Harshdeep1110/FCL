import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { runningTotal } from "@/lib/chips";
import { CHIP_RULES } from "@/lib/config";
import { ChipShop, type ChipTargetPlayer } from "@/components/ChipShop";
import { PageHeader } from "@/components/ui/PageHeader";
import { AnimatedNumber } from "@/components/ui/motion";

export const dynamic = "force-dynamic";

export default async function ChipsPage() {
  const user = await requireUser();

  // The next open gameweek (deadline in the future, not locked).
  const gw = await prisma.gameweek.findFirst({
    where: { locked: false, deadline: { gt: new Date() } },
    orderBy: { deadline: "asc" },
  });

  const [total, chipsEver, players, clubs] = await Promise.all([
    runningTotal(user.id),
    prisma.chipPurchase.count({ where: { userId: user.id } }),
    prisma.player.findMany({
      select: { id: true, name: true, position: true, club: { select: { name: true } } },
      orderBy: { currentPrice: "desc" },
    }),
    prisma.club.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const chipsThisGw = gw
    ? await prisma.chipPurchase.findMany({
        where: { userId: user.id, gameweekId: gw.id },
        select: { chipType: true },
      })
    : [];

  const targetPlayers: ChipTargetPlayer[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    clubName: p.club.name,
  }));

  return (
    <main className="flex min-h-screen flex-col">
      <PageHeader
        title="Black Market"
        back="/"
        right={
          <span>
            Running total:{" "}
            <AnimatedNumber
              value={total}
              className="font-mono text-ok"
            />{" "}
            pts
          </span>
        }
      />

      {!gw ? (
        <p className="p-6 text-muted">No open gameweek to buy chips for right now.</p>
      ) : (
        <ChipShop
          gameweekId={gw.id}
          gameweekNumber={gw.number}
          deadline={gw.deadline.toISOString()}
          runningTotal={total}
          freeChipAvailable={chipsEver < CHIP_RULES.freeChipsPerUser}
          chipsUsedThisGw={chipsThisGw.map((c) => c.chipType)}
          players={targetPlayers}
          clubs={clubs}
        />
      )}
    </main>
  );
}
