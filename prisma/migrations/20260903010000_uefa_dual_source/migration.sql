-- DropForeignKey
ALTER TABLE "PlayerGameweekStat" DROP CONSTRAINT "PlayerGameweekStat_fixtureId_fkey";

-- DropIndex
DROP INDEX "PlayerGameweekStat_playerId_fixtureId_key";

-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "uefaTeamId" INTEGER,
ALTER COLUMN "apiFootballTeamId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Fixture" ADD COLUMN     "uefaMatchId" TEXT,
ALTER COLUMN "apiFootballFixtureId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "uefaPlayerId" TEXT,
ALTER COLUMN "apiFootballPlayerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PlayerGameweekStat" ADD COLUMN     "ballsRecovered" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "fixtureId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Club_uefaTeamId_key" ON "Club"("uefaTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "Fixture_uefaMatchId_key" ON "Fixture"("uefaMatchId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_uefaPlayerId_key" ON "Player"("uefaPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerGameweekStat_playerId_gameweekId_key" ON "PlayerGameweekStat"("playerId", "gameweekId");

-- AddForeignKey
ALTER TABLE "PlayerGameweekStat" ADD CONSTRAINT "PlayerGameweekStat_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

