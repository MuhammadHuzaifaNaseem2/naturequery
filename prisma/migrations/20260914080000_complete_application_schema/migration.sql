-- Restore the schema history for application models that previously existed only
-- in schema.prisma. Billing webhook reliability is added by the next migration.

CREATE TYPE "TeamMemberStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING', 'INCOMPLETE');
CREATE TYPE "ScheduleFrequency" AS ENUM ('HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY');

ALTER TABLE "User" ADD COLUMN "backupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "dashboardShareToken" TEXT,
ADD COLUMN "groqApiKey" TEXT,
ADD COLUMN "isDashboardPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN "lockedUntil" TIMESTAMP(3),
ADD COLUMN "loginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "passwordChangedAt" TIMESTAMP(3),
ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "twoFactorSecret" TEXT;

ALTER TABLE "TeamMember" ADD COLUMN "status" "TeamMemberStatus" NOT NULL DEFAULT 'PENDING';

ALTER TABLE "SavedQuery" ADD COLUMN "connectionId" TEXT,
ADD COLUMN "connectionName" TEXT,
ADD COLUMN "isTemplate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "shareToken" TEXT,
ADD COLUMN "templateCategory" TEXT;

ALTER TABLE "AuditLog" ADD COLUMN "entryData" TEXT,
ADD COLUMN "hash" TEXT,
ADD COLUMN "previousHash" TEXT;

CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QueryHistory" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "sql" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT,
    "connectionName" TEXT,
    "rowCount" INTEGER,
    "executionTimeMs" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'success',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QueryHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DashboardWidget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "sql" TEXT NOT NULL,
    "connectionId" TEXT,
    "connectionName" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DashboardWidget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduledQuery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "sql" TEXT NOT NULL,
    "connectionId" TEXT,
    "connectionName" TEXT,
    "frequency" "ScheduleFrequency" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScheduledQuery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OnboardingChecklist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectedDb" BOOLEAN NOT NULL DEFAULT false,
    "askedFirstQuestion" BOOLEAN NOT NULL DEFAULT false,
    "pinnedChart" BOOLEAN NOT NULL DEFAULT false,
    "invitedTeamMember" BOOLEAN NOT NULL DEFAULT false,
    "setupSchedule" BOOLEAN NOT NULL DEFAULT false,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OnboardingChecklist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QueryFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "generatedSql" TEXT NOT NULL,
    "correctedSql" TEXT,
    "rating" INTEGER NOT NULL,
    "chainOfThought" TEXT,
    "connectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QueryFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");
CREATE INDEX "PasswordResetToken_email_idx" ON "PasswordResetToken"("email");
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");
CREATE INDEX "QueryHistory_userId_createdAt_idx" ON "QueryHistory"("userId", "createdAt");
CREATE INDEX "QueryHistory_userId_connectionId_idx" ON "QueryHistory"("userId", "connectionId");
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");
CREATE INDEX "Subscription_stripeSubscriptionId_idx" ON "Subscription"("stripeSubscriptionId");
CREATE INDEX "UsageRecord_userId_action_createdAt_idx" ON "UsageRecord"("userId", "action", "createdAt");
CREATE INDEX "DashboardWidget_userId_idx" ON "DashboardWidget"("userId");
CREATE INDEX "DashboardWidget_userId_position_idx" ON "DashboardWidget"("userId", "position");
CREATE INDEX "ScheduledQuery_userId_idx" ON "ScheduledQuery"("userId");
CREATE INDEX "ScheduledQuery_enabled_nextRunAt_idx" ON "ScheduledQuery"("enabled", "nextRunAt");
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE UNIQUE INDEX "OnboardingChecklist_userId_key" ON "OnboardingChecklist"("userId");
CREATE INDEX "OnboardingChecklist_userId_idx" ON "OnboardingChecklist"("userId");
CREATE INDEX "QueryFeedback_userId_idx" ON "QueryFeedback"("userId");
CREATE INDEX "QueryFeedback_userId_createdAt_idx" ON "QueryFeedback"("userId", "createdAt");
CREATE INDEX "QueryFeedback_rating_idx" ON "QueryFeedback"("rating");
CREATE UNIQUE INDEX "User_dashboardShareToken_key" ON "User"("dashboardShareToken");
CREATE UNIQUE INDEX "SavedQuery_shareToken_key" ON "SavedQuery"("shareToken");
CREATE INDEX "SavedQuery_userId_isFavorite_idx" ON "SavedQuery"("userId", "isFavorite");
CREATE INDEX "SavedQuery_userId_isTemplate_idx" ON "SavedQuery"("userId", "isTemplate");
CREATE INDEX "SavedQuery_userId_createdAt_idx" ON "SavedQuery"("userId", "createdAt");
CREATE INDEX "SavedQuery_shareToken_idx" ON "SavedQuery"("shareToken");
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

ALTER TABLE "QueryHistory" ADD CONSTRAINT "QueryHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DashboardWidget" ADD CONSTRAINT "DashboardWidget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledQuery" ADD CONSTRAINT "ScheduledQuery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnboardingChecklist" ADD CONSTRAINT "OnboardingChecklist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QueryFeedback" ADD CONSTRAINT "QueryFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
