-- AlterTable: store the time, weekday, day of month and time zone people pick for a schedule.
-- IF NOT EXISTS keeps this safe to re-run.
ALTER TABLE "ScheduledQuery" ADD COLUMN IF NOT EXISTS "timeOfDay" TEXT,
ADD COLUMN IF NOT EXISTS "dayOfWeek" INTEGER,
ADD COLUMN IF NOT EXISTS "dayOfMonth" INTEGER,
ADD COLUMN IF NOT EXISTS "timezone" TEXT;
