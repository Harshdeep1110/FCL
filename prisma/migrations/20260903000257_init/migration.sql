-- CreateEnum
CREATE TYPE "Position" AS ENUM ('GK', 'DEF', 'MID', 'ATT');

-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('LEAGUE', 'RO16', 'QF', 'SF', 'FINAL');

-- CreateEnum
CREATE TYPE "SquadStage" AS ENUM ('LEAGUE', 'KNOCKOUT');

-- CreateEnum
CREATE TYPE "FixtureStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "ChipType" AS ENUM ('RED_CARD', 'BANKER', 'INFLATION', 'BENCH_BOOST', 'BOUNTY', 'FREE_HIT');

-- CreateEnum
CREATE TYPE "OverrideTargetType" AS ENUM ('PLAYER_GAMEWEEK_STAT', 'CHIP_PURCHASE', 'PLAYER_PRICE', 'LINEUP', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiFootballTeamId" INTEGER NOT NULL,
    "eliminated" BOOLEAN NOT NULL DEFAULT false,
    "eliminatedAt" TIMESTAMP(3),

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "position" "Position" NOT NULL,
    "apiFootballPlayerId" INTEGER NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "originalPrice" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gameweek" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "stage" "Stage" NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "statsComplete" BOOLEAN NOT NULL DEFAULT false,
    "pointsComputed" BOOLEAN NOT NULL DEFAULT false,
    "randomBoostSelected" BOOLEAN NOT NULL DEFAULT false,
    "chipsResolved" BOOLEAN NOT NULL DEFAULT false,
    "pricesRecomputed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Gameweek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fixture" (
    "id" TEXT NOT NULL,
    "apiFootballFixtureId" INTEGER NOT NULL,
    "clubHomeId" TEXT NOT NULL,
    "clubAwayId" TEXT NOT NULL,
    "kickoffTime" TIMESTAMP(3) NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "stage" "Stage" NOT NULL,
    "status" "FixtureStatus" NOT NULL DEFAULT 'SCHEDULED',
    "statsPulled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Fixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerGameweekStat" (
    "id" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "minutesPlayed" INTEGER NOT NULL DEFAULT 0,
    "minutesExtraTime" INTEGER NOT NULL DEFAULT 0,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "cleanSheet" BOOLEAN NOT NULL DEFAULT false,
    "goalsConceded" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "penaltiesSaved" INTEGER NOT NULL DEFAULT 0,
    "penaltiesMissed" INTEGER NOT NULL DEFAULT 0,
    "yellowCards" INTEGER NOT NULL DEFAULT 0,
    "redCards" INTEGER NOT NULL DEFAULT 0,
    "ownGoals" INTEGER NOT NULL DEFAULT 0,
    "cbitCount" INTEGER NOT NULL DEFAULT 0,
    "isDefensiveContributionMet" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PlayerGameweekStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerGameweekPoints" (
    "id" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "basePoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "randomBoosted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PlayerGameweekPoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Squad" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stage" "SquadStage" NOT NULL,
    "budget" DOUBLE PRECISION NOT NULL,
    "budgetSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Squad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquadPlayer" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "isStarting" BOOLEAN NOT NULL DEFAULT false,
    "isCaptain" BOOLEAN NOT NULL DEFAULT false,
    "priceAtDraft" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SquadPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lineup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "stage" "SquadStage" NOT NULL,
    "isFreeHit" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineupPlayer" (
    "id" TEXT NOT NULL,
    "lineupId" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "position" "Position" NOT NULL,
    "isStarting" BOOLEAN NOT NULL,
    "isCaptain" BOOLEAN NOT NULL DEFAULT false,
    "finalPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "LineupPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChipPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chipType" "ChipType" NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "pointsCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "targetPlayerId" INTEGER,
    "targetClubId" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resultPoints" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChipPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BountyPayout" (
    "id" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "BountyPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RandomBoostSelection" (
    "id" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RandomBoostSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "priceBefore" DOUBLE PRECISION NOT NULL,
    "priceAfter" DOUBLE PRECISION NOT NULL,
    "rawDelta" DOUBLE PRECISION NOT NULL,
    "smoothedDelta" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferBank" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "freeTransfersAvailable" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TransferBank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "playerOutId" INTEGER NOT NULL,
    "playerInId" INTEGER NOT NULL,
    "wasFreeTransfer" BOOLEAN NOT NULL DEFAULT true,
    "pointsPenalty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGameweekScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "startingPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "benchPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "chipCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bountyGained" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bountyLost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transferPenalty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "UserGameweekScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminOverride" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "targetType" "OverrideTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "fieldChanged" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Club_apiFootballTeamId_key" ON "Club"("apiFootballTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_apiFootballPlayerId_key" ON "Player"("apiFootballPlayerId");

-- CreateIndex
CREATE INDEX "Player_clubId_idx" ON "Player"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "Gameweek_number_stage_key" ON "Gameweek"("number", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "Fixture_apiFootballFixtureId_key" ON "Fixture"("apiFootballFixtureId");

-- CreateIndex
CREATE INDEX "Fixture_gameweekId_idx" ON "Fixture"("gameweekId");

-- CreateIndex
CREATE INDEX "PlayerGameweekStat_gameweekId_idx" ON "PlayerGameweekStat"("gameweekId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerGameweekStat_playerId_fixtureId_key" ON "PlayerGameweekStat"("playerId", "fixtureId");

-- CreateIndex
CREATE INDEX "PlayerGameweekPoints_gameweekId_idx" ON "PlayerGameweekPoints"("gameweekId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerGameweekPoints_playerId_gameweekId_key" ON "PlayerGameweekPoints"("playerId", "gameweekId");

-- CreateIndex
CREATE UNIQUE INDEX "Squad_userId_stage_key" ON "Squad"("userId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "SquadPlayer_squadId_playerId_key" ON "SquadPlayer"("squadId", "playerId");

-- CreateIndex
CREATE INDEX "Lineup_gameweekId_idx" ON "Lineup"("gameweekId");

-- CreateIndex
CREATE UNIQUE INDEX "Lineup_userId_gameweekId_key" ON "Lineup"("userId", "gameweekId");

-- CreateIndex
CREATE UNIQUE INDEX "LineupPlayer_lineupId_playerId_key" ON "LineupPlayer"("lineupId", "playerId");

-- CreateIndex
CREATE INDEX "ChipPurchase_gameweekId_idx" ON "ChipPurchase"("gameweekId");

-- CreateIndex
CREATE INDEX "ChipPurchase_userId_idx" ON "ChipPurchase"("userId");

-- CreateIndex
CREATE INDEX "BountyPayout_gameweekId_idx" ON "BountyPayout"("gameweekId");

-- CreateIndex
CREATE UNIQUE INDEX "RandomBoostSelection_gameweekId_playerId_key" ON "RandomBoostSelection"("gameweekId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceHistory_playerId_gameweekId_key" ON "PriceHistory"("playerId", "gameweekId");

-- CreateIndex
CREATE UNIQUE INDEX "TransferBank_userId_gameweekId_key" ON "TransferBank"("userId", "gameweekId");

-- CreateIndex
CREATE INDEX "Transfer_userId_gameweekId_idx" ON "Transfer"("userId", "gameweekId");

-- CreateIndex
CREATE INDEX "UserGameweekScore_gameweekId_idx" ON "UserGameweekScore"("gameweekId");

-- CreateIndex
CREATE UNIQUE INDEX "UserGameweekScore_userId_gameweekId_key" ON "UserGameweekScore"("userId", "gameweekId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_clubHomeId_fkey" FOREIGN KEY ("clubHomeId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_clubAwayId_fkey" FOREIGN KEY ("clubAwayId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameweekStat" ADD CONSTRAINT "PlayerGameweekStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameweekStat" ADD CONSTRAINT "PlayerGameweekStat_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameweekStat" ADD CONSTRAINT "PlayerGameweekStat_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameweekPoints" ADD CONSTRAINT "PlayerGameweekPoints_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameweekPoints" ADD CONSTRAINT "PlayerGameweekPoints_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Squad" ADD CONSTRAINT "Squad_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadPlayer" ADD CONSTRAINT "SquadPlayer_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadPlayer" ADD CONSTRAINT "SquadPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lineup" ADD CONSTRAINT "Lineup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lineup" ADD CONSTRAINT "Lineup_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupPlayer" ADD CONSTRAINT "LineupPlayer_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "Lineup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupPlayer" ADD CONSTRAINT "LineupPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChipPurchase" ADD CONSTRAINT "ChipPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChipPurchase" ADD CONSTRAINT "ChipPurchase_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChipPurchase" ADD CONSTRAINT "ChipPurchase_targetPlayerId_fkey" FOREIGN KEY ("targetPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChipPurchase" ADD CONSTRAINT "ChipPurchase_targetClubId_fkey" FOREIGN KEY ("targetClubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BountyPayout" ADD CONSTRAINT "BountyPayout_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BountyPayout" ADD CONSTRAINT "BountyPayout_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BountyPayout" ADD CONSTRAINT "BountyPayout_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BountyPayout" ADD CONSTRAINT "BountyPayout_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RandomBoostSelection" ADD CONSTRAINT "RandomBoostSelection_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RandomBoostSelection" ADD CONSTRAINT "RandomBoostSelection_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferBank" ADD CONSTRAINT "TransferBank_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferBank" ADD CONSTRAINT "TransferBank_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_playerOutId_fkey" FOREIGN KEY ("playerOutId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_playerInId_fkey" FOREIGN KEY ("playerInId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGameweekScore" ADD CONSTRAINT "UserGameweekScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGameweekScore" ADD CONSTRAINT "UserGameweekScore_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminOverride" ADD CONSTRAINT "AdminOverride_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
