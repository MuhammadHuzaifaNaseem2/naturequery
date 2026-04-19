-- Add locale column to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'en';

-- Add comment
COMMENT ON COLUMN "User"."locale" IS 'User preferred language: en, es, fr, de, ja';


