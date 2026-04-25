"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Bot } from "lucide-react";
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
          className="absolute right-0 top-8 z-20 w-[440px] rounded-lg border border-border bg-card p-3 shadow-lg"
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
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {!data.stats ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No close past matches. Try the AI estimate below.
            </p>
          ) : (
            <>
              <div className="mt-3 rounded-md border border-border bg-secondary/40 p-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    Median (your past quotes)
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

              <div className="mt-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Similar past lines ({data.matches.length})
                </p>
                <ul className="mt-1 max-h-[140px] space-y-1 overflow-y-auto text-xs">
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

          {/* AI estimate */}
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-900">
                <Bot size={12} /> AI estimate (Claude)
              </span>
              {!ai && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={askAi}
                  disabled={aiPending}
                >
                  {aiPending ? "Thinking…" : "Ask Claude"}
                </Button>
              )}
            </div>

            {aiError && (
              <p className="mt-2 text-xs text-red-700">{aiError}</p>
            )}

            {ai && (
              <>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xs text-emerald-900">
                    {ai.confidence.toUpperCase()} confidence
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-emerald-900">
                    {ai.unitPrice.toLocaleString("cs-CZ", { minimumFractionDigits: 2 })} Kč
                    {ai.unit ? `/${ai.unit}` : ""}
                  </span>
                </div>
                <p className="mt-1 text-xs italic text-emerald-900/80">
                  &ldquo;{ai.reasoning}&rdquo;
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] text-emerald-900/60">
                    ${ai.estimatedCostUsd.toFixed(4)} · {ai.inputTokens}+{ai.outputTokens} tokens
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => apply(ai.unitPrice, ai.unit || null)}
                  >
                    Apply AI estimate
                  </Button>
                </div>
              </>
            )}

            {!ai && !aiError && !aiPending && (
              <p className="mt-1 text-[11px] text-emerald-900/70">
                For new line types or a sanity-check on the retrieval result.
                Each call costs &lt;$0.01.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
