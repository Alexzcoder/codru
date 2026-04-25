"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Bot, X } from "lucide-react";
import {
  suggestPriceForDescription,
  askClaudeForPrice,
} from "@/lib/pricing-history/actions";
import type { Suggestion } from "@/lib/pricing-history";
import type { AiEstimate } from "@/lib/pricing-history/ai-estimate";

export function PriceSuggester({
  description,
  onApply,
}: {
  description: string;
  onApply: (unitPrice: string, unit: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Suggestion | null>(null);
  const [ai, setAi] = useState<AiEstimate | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [aiPending, startAi] = useTransition();

  const fetchSuggestion = () => {
    startTransition(async () => {
      const r = await suggestPriceForDescription(description);
      setData(r);
      setAi(null);
      setAiError(null);
      setOpen(true);
    });
  };

  const askAi = () => {
    setAiError(null);
    startAi(async () => {
      const r = await askClaudeForPrice(description);
      if (r.ok) setAi(r.estimate);
      else setAiError(r.message);
    });
  };

  const close = () => setOpen(false);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const apply = (price: number, unit: string | null) => {
    onApply(price.toFixed(2), unit);
    close();
  };

  return (
    <>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h3 className="text-base font-semibold">Suggested price</h3>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                  For: <span className="text-foreground">{description}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="cursor-pointer text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body — two columns: history left, AI right */}
            <div className="grid gap-4 p-5 md:grid-cols-2">
              {/* History panel */}
              <section>
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground">
                  From your past quotes
                </h4>
                {!data.stats ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No close past matches found.
                  </p>
                ) : (
                  <>
                    <div className="mt-2 rounded-md border border-border bg-secondary/40 p-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted-foreground">Median</span>
                        <span className="text-lg font-semibold tabular-nums">
                          {data.stats.medianUnitPrice?.toLocaleString("cs-CZ", {
                            minimumFractionDigits: 2,
                          })}{" "}
                          Kč
                          {data.stats.detectedUnit ? `/${data.stats.detectedUnit}` : ""}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-baseline justify-between text-xs text-muted-foreground tabular-nums">
                        <span>Range (P25–P75)</span>
                        <span>
                          {data.stats.p25UnitPrice?.toFixed(0)} – {data.stats.p75UnitPrice?.toFixed(0)} Kč
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
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
                          Low
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
                          High
                        </Button>
                      </div>
                    </div>

                    <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">
                      Similar lines ({data.matches.length})
                    </p>
                    <ul className="mt-1 space-y-0.5 text-xs">
                      {data.matches.slice(0, 6).map((m, i) => (
                        <li key={i}>
                          <button
                            type="button"
                            onClick={() => apply(m.unitPrice, m.unit || null)}
                            className="flex w-full items-start justify-between gap-2 rounded px-1.5 py-1 text-left hover:bg-secondary/40"
                          >
                            <span className="flex-1 truncate">
                              {m.description}
                            </span>
                            <span className="shrink-0 tabular-nums font-medium">
                              {m.unitPrice.toLocaleString("cs-CZ")} Kč
                              {m.unit ? `/${m.unit}` : ""}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>

              {/* AI panel */}
              <section>
                <h4 className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-emerald-700">
                  <Bot size={12} /> AI estimate (Claude)
                </h4>

                {!ai && !aiPending && !aiError && (
                  <div className="mt-2 rounded-md border border-dashed border-emerald-200 bg-emerald-50/40 p-3">
                    <p className="text-xs text-emerald-900/80">
                      Best for new line types or as a sanity-check. Anchors on
                      your past prices to suggest a value with reasoning.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="mt-2 h-7 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                      onClick={askAi}
                    >
                      Ask Claude (≈ $0.005)
                    </Button>
                  </div>
                )}

                {aiPending && (
                  <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                    Thinking… (typically ~2–4 seconds)
                  </div>
                )}

                {aiError && (
                  <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                    {aiError}
                  </div>
                )}

                {ai && (
                  <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 p-3">
                    <div className="flex items-baseline justify-between">
                      <span className="rounded-full bg-emerald-200/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-900">
                        {ai.confidence} confidence
                      </span>
                      <span className="text-lg font-semibold tabular-nums text-emerald-900">
                        {ai.unitPrice.toLocaleString("cs-CZ", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        Kč{ai.unit ? `/${ai.unit}` : ""}
                      </span>
                    </div>
                    <p className="mt-2 text-xs italic leading-relaxed text-emerald-900/80">
                      &ldquo;{ai.reasoning}&rdquo;
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[10px] text-emerald-900/60 tabular-nums">
                        ${ai.estimatedCostUsd.toFixed(4)} ·{" "}
                        {ai.inputTokens}+{ai.outputTokens} tokens
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                        onClick={() => apply(ai.unitPrice, ai.unit || null)}
                      >
                        Apply estimate
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
