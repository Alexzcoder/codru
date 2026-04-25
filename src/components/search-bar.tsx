"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

// Minimal search input that pushes ?q=... onto the current pathname.
// Preserves any other existing query params.
export function SearchBar({
  pathname,
  initialQ,
  preserveParams = {},
  placeholder = "Search…",
}: {
  pathname: string;
  initialQ: string;
  preserveParams?: Record<string, string | undefined>;
  placeholder?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [, startTransition] = useTransition();

  const submit = (next: string) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(preserveParams)) {
      if (v) params.set(k, v);
    }
    if (next.trim()) params.set("q", next.trim());
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };

  return (
    <div className="relative max-w-sm">
      <Search
        size={14}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onBlur={() => submit(q)}
        onKeyDown={(e) => e.key === "Enter" && submit(q)}
        className="pl-8"
      />
    </div>
  );
}
