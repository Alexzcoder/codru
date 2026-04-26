"use client";

import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useTransition } from "react";

// Click-to-sort table header. Owner page renders <thead><th><SortHeader …/>
// per column. Sort state lives in the URL as ?sort=<field>&dir=asc|desc, so
// it's bookmarkable and survives navigation. Server pages read the same
// params and feed them to Prisma's orderBy.
export function SortHeader({
  label,
  field,
  align = "left",
}: {
  label: string;
  field: string;
  align?: "left" | "right" | "center";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSort = sp.get("sort");
  const currentDir = sp.get("dir") === "asc" ? "asc" : "desc";
  const active = currentSort === field;

  const next = () => {
    const params = new URLSearchParams(sp.toString());
    if (!active) {
      params.set("sort", field);
      params.set("dir", "desc");
    } else if (currentDir === "desc") {
      params.set("sort", field);
      params.set("dir", "asc");
    } else {
      params.delete("sort");
      params.delete("dir");
    }
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };

  const Icon = !active ? ArrowUpDown : currentDir === "asc" ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      onClick={next}
      className={`inline-flex w-full items-center gap-1 ${
        align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""
      } cursor-pointer select-none uppercase tracking-wider hover:text-foreground ${
        active ? "text-foreground" : "text-muted-foreground"
      } ${isPending ? "opacity-60" : ""}`}
    >
      <span>{label}</span>
      <Icon size={11} className={active ? "opacity-100" : "opacity-40"} />
    </button>
  );
}
