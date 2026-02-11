-- AlterTable: Add provisionLog JSON field to instances
ALTER TABLE "instances" ADD COLUMN IF NOT EXISTS "provisionLog" JSONB;
