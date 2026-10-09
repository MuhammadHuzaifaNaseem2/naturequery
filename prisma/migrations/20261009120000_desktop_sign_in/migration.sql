-- CreateTable
CREATE TABLE "DesktopAuthCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceName" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesktopAuthCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesktopSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "accessExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "previousRefreshTokenHash" TEXT,
    "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshedAt" TIMESTAMP(3),
    "deviceName" TEXT,
    "platform" TEXT,
    "appVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "DesktopSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DesktopAuthCode_codeHash_key" ON "DesktopAuthCode"("codeHash");

-- CreateIndex
CREATE INDEX "DesktopAuthCode_userId_idx" ON "DesktopAuthCode"("userId");

-- CreateIndex
CREATE INDEX "DesktopAuthCode_expiresAt_idx" ON "DesktopAuthCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DesktopSession_accessTokenHash_key" ON "DesktopSession"("accessTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "DesktopSession_refreshTokenHash_key" ON "DesktopSession"("refreshTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "DesktopSession_previousRefreshTokenHash_key" ON "DesktopSession"("previousRefreshTokenHash");

-- CreateIndex
CREATE INDEX "DesktopSession_userId_idx" ON "DesktopSession"("userId");

-- AddForeignKey
ALTER TABLE "DesktopAuthCode" ADD CONSTRAINT "DesktopAuthCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesktopSession" ADD CONSTRAINT "DesktopSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

