"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { suggestPriceForDescription } from "@/lib/pricing-history/actions";
import type { Suggestion } from "@/lib/pricing-history";

// Pops a small inline panel showing similar past line items + a suggested
// median price. Caller passes the current name+description and gets a callback
// when the user picks a price to apply.
export function PriceSuggester({
  description,
  onApply,
}: {
  description: string;
  onApply: (unitPrice: string, unit: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Suggestion | null>(null);
  const [pending, startTransition] = useTransition();

  const fetchSuggestion = () => {
    startTransition(async () => {
      const r = await suggestPriceForDescription(description);
      setData(r);
      setOpen(true);
    });
  };

  const close = () => setOpen(false);

  const apply = (price: number, unit: string | null) => {
    onApply(price.toFixed(2), unit);
    close();
  };

  return (
    <div className="relative">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 gap-1 px-1.5 text-muted-foreground hover:text-foreground"
        onClick={fetchSuggestion}
        disabled={pending || description.trim().length < 3}
        title="Suggest a price from your past quotes"
      >
        <Sparkles size={12} />
      </Button>
      {open && data && (
        <div
          className="absolute right-0 top-8 z-20 w-[420px] rounded-lg border border-border bg-card p-3 shadow-lg"
          onMouseLeave={close}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold">Suggested price</h4>
              <p className="text-xs text-muted-foreground">
                Based on your past quotes for similar line items.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </div>

          {!data.stats ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No similar past lines found. Try a longer or more specific description.
            </p>
          ) : (
            <>
              <div className="mt-3 rounded-md border border-border bg-secondary/40 p-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    Median
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {data.stats.medianUnitPrice?.toLocaleString("cs-CZ", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    Kč{data.stats.detectedUnit ? `/${data.stats.detectedUnit}` : ""}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between text-xs text-muted-foreground tabular-nums">
                  <span>Range (P25–P75)</span>
                  <span>
                    {data.stats.p25UnitPrice?.toFixed(0)} – {data.stats.p75UnitPrice?.toFixed(0)} Kč
                  </span>
                </div>
                <div className="mt-2 flex gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      apply(data.stats!.medianUnitPrice ?? 0, data.stats!.detectedUnit)
                    }
                  >
                    Use median
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() =>
                      apply(data.stats!.p25UnitPrice ?? 0, data.stats!.detectedUnit)
                    }
                  >
                    Low (P25)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() =>
                      apply(data.stats!.p75UnitPrice ?? 0, data.stats!.detectedUnit)
                    }
                  >
                    High (P75)
                  </Button>
                </div>
              </div>

              <div className="mt-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Similar past lines ({data.matches.length})
                </p>
                <ul className="mt-1 max-h-[180px] space-y-1 overflow-y-auto text-xs">
                  {data.matches.map((m, i) => (
                    <li
                      key={i}
                      className="flex items-start justify-between gap-2 rounded border border-transparent px-1 py-1 hover:border-border hover:bg-secondary/40"
                    >
                      <button
                        type="button"
                        className="flex-1 text-left"
                        onClick={() => apply(m.unitPrice, m.unit || null)}
                      >
                        <span className="block truncate">{m.description}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {m.issueDate ?? ""} · {m.source}
                        </span>
                      </button>
                      <span className="shrink-0 tabular-nums font-medium">
                        {m.unitPrice.toLocaleString("cs-CZ")} Kč
                        {m.unit ? `/${m.unit}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
