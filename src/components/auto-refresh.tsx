"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ponytail: polling keeps concurrent users in sync; upgrade to SSE/WebSockets
// if the refresh interval ever feels too slow.
export function AutoRefresh({ intervalMs = 10000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
