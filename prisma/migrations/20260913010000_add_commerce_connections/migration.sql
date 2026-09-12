CREATE TABLE "CommerceConnection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'woocommerce',
    "storeUrl" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceConnection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommerceConnection_userId_idx" ON "CommerceConnection"("userId");
CREATE UNIQUE INDEX "CommerceConnection_userId_provider_storeUrl_key"
    ON "CommerceConnection"("userId", "provider", "storeUrl");

ALTER TABLE "CommerceConnection" ADD CONSTRAINT "CommerceConnection_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
