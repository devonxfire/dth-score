/*
  Warnings:

  - You are about to drop the `Group` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `scorecard_stats` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Group" DROP CONSTRAINT "Group_competitionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Group" DROP CONSTRAINT "Group_teamId_fkey";

-- DropForeignKey
ALTER TABLE "public"."scorecard_stats" DROP CONSTRAINT "scorecard_stats_competition_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."scorecard_stats" DROP CONSTRAINT "scorecard_stats_team_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."scorecard_stats" DROP CONSTRAINT "scorecard_stats_user_id_fkey";

-- AlterTable
ALTER TABLE "public"."competitions" ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'Open';

-- DropTable
DROP TABLE "public"."Group";

-- DropTable
DROP TABLE "public"."scorecard_stats";
