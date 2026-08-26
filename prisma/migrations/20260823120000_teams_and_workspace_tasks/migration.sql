-- Teams (committees) + standalone workspace tasks.
-- EventTodo becomes the single task model: workspaceId denormalized (backfilled
-- from Event), eventId now optional (NULL = standalone /tasks board task),
-- optional teamId so a task can belong to a committee.

CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Team_workspaceId_name_key" ON "Team"("workspaceId", "name");

ALTER TABLE "Team" ADD CONSTRAINT "Team_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TeamMember" (
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("teamId", "userId")
);

ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EventTodo: add workspaceId (backfill from the parent event, then NOT NULL),
-- relax eventId, add teamId.
ALTER TABLE "EventTodo" ADD COLUMN "workspaceId" TEXT;

UPDATE "EventTodo" t
SET "workspaceId" = e."workspaceId"
FROM "Event" e
WHERE t."eventId" = e."id";

ALTER TABLE "EventTodo" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "EventTodo" ALTER COLUMN "eventId" DROP NOT NULL;
ALTER TABLE "EventTodo" ADD COLUMN "teamId" TEXT;

ALTER TABLE "EventTodo" ADD CONSTRAINT "EventTodo_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventTodo" ADD CONSTRAINT "EventTodo_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "EventTodo_workspaceId_status_idx" ON "EventTodo"("workspaceId", "status");
CREATE INDEX "EventTodo_teamId_idx" ON "EventTodo"("teamId");
