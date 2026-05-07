// Check what state the production DB is actually in. Three things to confirm:
//   1. Did the per-day numbering migration apply? (column "dateKey" exists)
//   2. Did the recent client-attachment migration apply?
//   3. Are there any UNSENT docs the operator might have been clicking on?
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const migrations = await prisma.$queryRaw`
  SELECT migration_name, finished_at IS NOT NULL AS finished, logs
  FROM "_prisma_migrations"
  ORDER BY started_at DESC
  LIMIT 10
`;
console.log("Last 10 migrations:");
for (const m of migrations) {
  console.log(`  ${m.finished ? "✓" : "✗"}  ${m.migration_name}`);
  if (!m.finished && m.logs) console.log(`     ERR: ${m.logs.slice(0, 200)}`);
}

const cols = await prisma.$queryRaw`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'NumberSeries'
`;
console.log(`\nNumberSeries columns: ${cols.map(c => c.column_name).join(", ")}`);

const attCols = await prisma.$queryRaw`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'Attachment'
`;
console.log(`Attachment columns: ${attCols.map(c => c.column_name).join(", ")}`);

// Recent SENT documents
const recent = await prisma.document.findMany({
  where: { status: "SENT" },
  orderBy: { sentAt: "desc" },
  take: 5,
  select: { id: true, number: true, type: true, sentAt: true, status: true, issueDate: true },
});
console.log("\nLast 5 SENT documents:");
for (const d of recent) {
  console.log(`  ${d.sentAt?.toISOString() ?? "?"}  ${d.type.padEnd(15)}  ${d.number ?? "(no number)"}  issue=${d.issueDate.toISOString().slice(0,10)}`);
}

// UNSENT (drafts) the operator might be staring at
const drafts = await prisma.document.findMany({
  where: { status: "UNSENT", deletedAt: null },
  orderBy: { updatedAt: "desc" },
  take: 5,
  select: { id: true, type: true, updatedAt: true, workspaceId: true },
});
console.log(`\nUNSENT drafts (most recent): ${drafts.length}`);
for (const d of drafts) {
  console.log(`  ${d.updatedAt.toISOString()}  ${d.type.padEnd(15)}  ws=${d.workspaceId}  id=${d.id}`);
}
await prisma.$disconnect();
