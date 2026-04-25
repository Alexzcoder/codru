-- CreateTable
CREATE TABLE "AiCall" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DECIMAL(10,6) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiCall_userId_createdAt_idx" ON "AiCall"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiCall_feature_createdAt_idx" ON "AiCall"("feature", "createdAt");
