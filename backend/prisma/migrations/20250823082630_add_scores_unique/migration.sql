/*
  Warnings:

  - A unique constraint covering the columns `[competition_id,team_id,user_id,hole_id]` on the table `scores` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "scores_competition_id_team_id_user_id_hole_id_key" ON "public"."scores"("competition_id", "team_id", "user_id", "hole_id");
