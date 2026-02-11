-- AlterTable: Add botConfig JSON field to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "botConfig" JSONB;

-- AlterEnum: Add new value first before using it
ALTER TYPE "OnboardingStep" ADD VALUE IF NOT EXISTS 'configuring_workspace';
