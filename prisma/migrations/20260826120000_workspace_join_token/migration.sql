-- Shareable per-workspace join link. Null = disabled (default for every
-- existing workspace — business workspaces are untouched unless an owner
-- explicitly enables the link).
ALTER TABLE "Workspace" ADD COLUMN "joinToken" TEXT;
CREATE UNIQUE INDEX "Workspace_joinToken_key" ON "Workspace"("joinToken");
