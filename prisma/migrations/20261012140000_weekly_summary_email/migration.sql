-- Weekly summary email switch, and a table that makes daily jobs run once per day.
-- IF NOT EXISTS keeps this safe to re-run.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "weeklySummaryEmail" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE IF NOT EXISTS "JobRun" (
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "JobRun_createdAt_idx" ON "JobRun"("createdAt");
