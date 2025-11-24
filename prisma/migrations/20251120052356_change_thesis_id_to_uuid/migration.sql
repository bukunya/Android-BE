/*
  Warnings:

  - The primary key for the `Thesis` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "Thesis" DROP CONSTRAINT "Thesis_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Thesis_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Thesis_id_seq";
