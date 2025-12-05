-- CreateTable
CREATE TABLE "public"."courses" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "location" VARCHAR(100),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."course_holes" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "par" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,

    CONSTRAINT "course_holes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_holes_course_id_number_key" ON "public"."course_holes"("course_id", "number");

-- AddForeignKey
ALTER TABLE "public"."course_holes" ADD CONSTRAINT "course_holes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."competitions" ADD CONSTRAINT "competitions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
