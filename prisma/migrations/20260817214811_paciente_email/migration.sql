/*
  Warnings:

  - Added the required column `email` to the `pacientes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "pacientes" ADD COLUMN     "email" TEXT NOT NULL;
