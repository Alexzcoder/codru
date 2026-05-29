-- AlterTable: secret token for the public ICS calendar subscription feed.
ALTER TABLE "Workspace" ADD COLUMN "icsToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_icsToken_key" ON "Workspace"("icsToken");
