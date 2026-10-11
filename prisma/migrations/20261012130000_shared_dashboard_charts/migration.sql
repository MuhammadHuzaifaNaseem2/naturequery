-- Shared dashboards can show charts: an owner switch, and the rows each chart draws.
-- IF NOT EXISTS keeps this safe to re-run.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dashboardShareCharts" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "DashboardWidget" ADD COLUMN IF NOT EXISTS "snapshot" JSONB,
ADD COLUMN IF NOT EXISTS "snapshotAt" TIMESTAMP(3);
