"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseImportItem } from "../actions";

// Drives parsing of the session's pending items one request at a time, from the
// browser. Each call is its own short server request, so a 25-file session never
// hits the body limit or a cumulative timeout. Refreshes the page after each so
// the user watches items flip to Parsed / Failed live.
export function AutoParser({ itemIds }: { itemIds: string[] }) {
  const router = useRouter();
  const started = useRef(false);
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (started.current || itemIds.length === 0) return;
    started.current = true;
    let cancelled = false;
    (async () => {
      for (const id of itemIds) {
        if (cancelled) return;
        try {
          await parseImportItem(id);
        } catch {
          // keep going — the item is marked FAILED server-side
        }
        if (cancelled) return;
        setDone((n) => n + 1);
        router.refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
    // Run once for this mounted session; refreshes pass new arrays but the ref
    // guard keeps a single drain loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (itemIds.length === 0) return null;

  return (
    <div className="mt-4 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      Parsing {done}/{itemIds.length}… you can stay on this page; it updates as
      each finishes.
    </div>
  );
}
