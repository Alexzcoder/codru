// Score a parsed document's client fields against the workspace's existing
// clients and return the best match (if any) plus a confidence score in 0..1.
// We don't add new heuristics until the simple ones break — IČO match is
// effectively perfect, email match is near-perfect, fuzzy name is the
// fallback for individuals without IČO.

import { prisma } from "@/lib/prisma";

export type CandidateClient = {
  id: string;
  type: "INDIVIDUAL" | "COMPANY";
  companyName: string | null;
  fullName: string | null;
  ico: string | null;
  email: string | null;
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Simple Jaccard similarity over word sets — surprisingly effective for
// "Tokareva Alena" vs "Alena Tokareva", "AGS Trade s.r.o." vs "AGS Trade".
function jaccardWord(a: string, b: string): number {
  const wa = new Set(normalize(a).split(" ").filter(Boolean));
  const wb = new Set(normalize(b).split(" ").filter(Boolean));
  if (wa.size === 0 || wb.size === 0) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / (wa.size + wb.size - inter);
}

export type MatchResult = {
  matchedClientId: string | null;
  confidence: number; // 0..1
  reason: string;
};

export async function matchClient({
  workspaceId,
  parsed,
}: {
  workspaceId: string;
  parsed: {
    clientName?: string | null;
    clientIco?: string | null;
    clientEmail?: string | null;
  };
}): Promise<MatchResult> {
  // 1. IČO exact (case-insensitive — sometimes printed with leading zeros).
  if (parsed.clientIco) {
    const ico = parsed.clientIco.replace(/\s+/g, "");
    const byIco = await prisma.client.findFirst({
      where: { workspaceId, ico, deletedAt: null },
      select: { id: true },
    });
    if (byIco) return { matchedClientId: byIco.id, confidence: 1.0, reason: "Exact IČO match" };
  }
  // 2. Email exact.
  if (parsed.clientEmail) {
    const email = parsed.clientEmail.trim().toLowerCase();
    const byEmail = await prisma.client.findFirst({
      where: { workspaceId, email, deletedAt: null },
      select: { id: true },
    });
    if (byEmail) return { matchedClientId: byEmail.id, confidence: 0.97, reason: "Exact email match" };
  }
  // 3. Fuzzy name. Pull all candidates (workspaces are small enough that this
  // is fine; if we ever exceed ~10K clients we'll add a trigram index).
  if (parsed.clientName) {
    const candidates = await prisma.client.findMany({
      where: { workspaceId, deletedAt: null },
      select: { id: true, companyName: true, fullName: true },
    });
    let best: { id: string; score: number } | null = null;
    for (const c of candidates) {
      const cName = c.companyName ?? c.fullName ?? "";
      if (!cName) continue;
      const score = jaccardWord(parsed.clientName, cName);
      if (!best || score > best.score) best = { id: c.id, score };
    }
    if (best && best.score >= 0.6) {
      return {
        matchedClientId: best.id,
        confidence: Math.min(0.95, best.score),
        reason: `Fuzzy name match (${(best.score * 100).toFixed(0)}%)`,
      };
    }
  }
  return { matchedClientId: null, confidence: 0, reason: "No match" };
}
