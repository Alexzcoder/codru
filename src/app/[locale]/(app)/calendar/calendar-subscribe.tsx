"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { CalendarPlus, Copy, Check, RefreshCw } from "lucide-react";
import { ensureCalendarFeedToken, rotateCalendarFeedToken } from "./feed-actions";

// "Subscribe in Google Calendar" — reveals the workspace's ICS feed URL. The
// user pastes it into Google Calendar → "Other calendars" → "From URL", and
// Google then auto-syncs Codru jobs & events (one-way) on its own schedule.
export function CalendarSubscribe() {
  const locale = useLocale();
  const cs = locale === "cs";
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  const feedUrl = token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/calendar/feed/${token}`
    : "";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !token) {
      start(async () => {
        const r = await ensureCalendarFeedToken();
        setToken(r.token);
      });
    }
  };

  const copy = async () => {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — user can select manually */
    }
  };

  const rotate = () => {
    if (!confirm(cs ? "Vygenerovat nový odkaz? Stávající přestane fungovat." : "Generate a new link? The current one will stop working.")) {
      return;
    }
    start(async () => {
      const r = await rotateCalendarFeedToken();
      setToken(r.token);
      setCopied(false);
    });
  };

  return (
    <div ref={rootRef} className="relative">
      <Button variant="outline" size="sm" onClick={toggle} className="gap-1.5">
        <CalendarPlus size={14} />
        {cs ? "Připojit do Google" : "Connect to Google"}
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-80 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md">
          <p className="text-sm font-medium">
            {cs ? "Předplatné kalendáře" : "Calendar subscription"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {cs
              ? "Zkopírujte odkaz a v Google Kalendáři jej přidejte přes „Další kalendáře → Z adresy URL“. Aktualizuje se automaticky."
              : "Copy this link, then in Google Calendar add it via “Other calendars → From URL”. It syncs automatically."}
          </p>

          <div className="mt-2 flex items-center gap-1.5">
            <input
              readOnly
              value={pending && !token ? (cs ? "Generuji…" : "Generating…") : feedUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs outline-none"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={copy}
              disabled={!feedUrl}
              className="h-8 shrink-0 px-2"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </Button>
          </div>

          <button
            type="button"
            onClick={rotate}
            disabled={pending}
            className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw size={12} />
            {cs ? "Vygenerovat nový odkaz" : "Regenerate link"}
          </button>
        </div>
      )}
    </div>
  );
}
