-- CreateTable
CREATE TABLE "public"."scorecard_stats" (
    "id" SERIAL NOT NULL,
    "competition_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "waters" INTEGER,
    "dog" BOOLEAN,
    "two_clubs" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scorecard_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scorecard_stats_competition_id_team_id_user_id_key" ON "public"."scorecard_stats"("competition_id", "team_id", "user_id");

-- AddForeignKey
ALTER TABLE "public"."scorecard_stats" ADD CONSTRAINT "scorecard_stats_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scorecard_stats" ADD CONSTRAINT "scorecard_stats_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scorecard_stats" ADD CONSTRAINT "scorecard_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
