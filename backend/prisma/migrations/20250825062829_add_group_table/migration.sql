-- CreateTable
CREATE TABLE "public"."Group" (
    "id" SERIAL NOT NULL,
    "competitionId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "teeTime" VARCHAR(20),
    "players" TEXT[],
    "teeboxes" JSONB,
    "handicaps" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Group" ADD CONSTRAINT "Group_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "public"."competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Group" ADD CONSTRAINT "Group_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
