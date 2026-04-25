"use server";

import { requireUser } from "@/lib/session";
import { suggestPrice as suggest, type Suggestion } from "./index";

export async function suggestPriceForDescription(
  description: string,
): Promise<Suggestion> {
  await requireUser();
  if (!description || description.trim().length < 3) {
    return { matches: [], stats: null };
  }
  return suggest(description, { topK: 8, minScore: 0.5 });
}
