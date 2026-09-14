ALTER TABLE "Subscription" ADD COLUMN "providerUpdatedAt" TIMESTAMP(3);

CREATE TABLE "BillingWebhookEvent" (
    "id" TEXT NOT NULL,
    "deduplicationKey" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "lastError" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "BillingWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingWebhookEvent_deduplicationKey_key"
    ON "BillingWebhookEvent"("deduplicationKey");
CREATE INDEX "BillingWebhookEvent_status_receivedAt_idx"
    ON "BillingWebhookEvent"("status", "receivedAt");
CREATE INDEX "BillingWebhookEvent_subscriptionId_idx"
    ON "BillingWebhookEvent"("subscriptionId");
