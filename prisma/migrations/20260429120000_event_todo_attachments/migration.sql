-- Cross-link EventAttachment ↔ EventTodo. When a file is uploaded from a
-- todo card we set both eventId and todoId — the file shows on the card AND
-- in the event's Files section. todoId NULL = uploaded directly to the event.

ALTER TABLE "EventAttachment" ADD COLUMN "todoId" TEXT;
ALTER TABLE "EventAttachment"
  ADD CONSTRAINT "EventAttachment_todoId_fkey"
    FOREIGN KEY ("todoId") REFERENCES "EventTodo"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "EventAttachment_todoId_idx" ON "EventAttachment"("todoId");
