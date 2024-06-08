/*
  Warnings:

  - Added the required column `imgCredit` to the `Post` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "imgCredit" TEXT NOT NULL;
