"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Bot, X } from "lucide-react";
import {
  draftEmailWithClaude,
  loadEmailComposerData,
  sendEmailFromComposer,
  type ComposerData,
} from "@/lib/email/actions";

export function EmailComposerButton({ documentId }: { documentId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Mail size={14} /> Email to client
      </Button>
      {open && <Composer documentId={documentId} onClose={() => setOpen(false)} />}
    </>
  );
}

function Composer({
  documentId,
  onClose,
}: {
  documentId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<ComposerData | null>(null);
  const [identityId, setIdentityId] = useState<string>("");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [language, setLanguage] = useState<"cs" | "en">("cs");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [draftedByAi, setDraftedByAi] = useState(false);
  const [draftCost, setDraftCost] = useState<number | null>(null);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const [loading, startLoading] = useTransition();
  const [drafting, startDraft] = useTransition();
  const [sending, startSending] = useTransition();

  useEffect(() => {
    startLoading(async () => {
      const d = await loadEmailComposerData(documentId);
      if (!d) return;
      setData(d);
      setIdentityId(d.defaultIdentityId ?? d.identities[0]?.id ?? "");
      setTo(d.client.email ?? "");
      setLanguage(d.document.locale);
    });
  }, [documentId]);

  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const draftWithClaude = () => {
    setAiErr(null);
    startDraft(async () => {
      const r = await draftEmailWithClaude({
        documentId,
        language,
        customerNote: null,
      });
      if (r.ok) {
        setSubject(r.subject);
        setBody(r.body);
        setDraftedByAi(true);
        setDraftCost(r.cost);
      } else {
        setAiErr(r.message);
      }
    });
  };

  const send = () => {
    setSendErr(null);
    if (!data || !identityId) return;
    startSending(async () => {
      const r = await sendEmailFromComposer({
        documentId,
        identityId,
        toAddress: to,
        ccAddress: cc || null,
        subject,
        body,
        language,
        draftedByClaude: draftedByAi,
      });
      if (r.ok) setSent(true);
      else setSendErr(r.error);
    });
  };

  const filename = data?.document.number
    ? `${data.document.number}.pdf`
    : `${data?.document.type.toLowerCase() ?? "document"}-draft.pdf`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-base font-semibold">Email to client</h3>
            {data && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data.document.number ?? "(draft)"} · {data.client.displayName} · attaches {filename}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        {loading || !data ? (
          <div className="px-5 py-10 text-sm text-muted-foreground">Loading…</div>
        ) : sent ? (
          <div className="space-y-3 px-5 py-10 text-center">
            <p className="text-base font-medium">Sent ✓</p>
            <p className="text-sm text-muted-foreground">
              Your email is on its way to {to}.
            </p>
            <Button type="button" onClick={onClose}>Close</Button>
          </div>
        ) : (
          <div className="space-y-3 p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="from-id" className="text-xs">From</Label>
                <select
                  id="from-id"
                  value={identityId}
                  onChange={(e) => setIdentityId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  {data.identities.length === 0 && (
                    <option value="">— no senders configured —</option>
                  )}
                  {data.identities.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.displayName ? `${i.displayName} <${i.fromAddress}>` : i.fromAddress}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Language</Label>
                <div className="mt-1 flex gap-1">
                  {(["cs", "en"] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLanguage(l)}
                      className={
                        language === l
                          ? "rounded-md bg-primary px-3 py-1.5 text-sm text-white"
                          : "rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground hover:bg-secondary/40 cursor-pointer"
                      }
                    >
                      {l === "cs" ? "Čeština" : "English"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="to-addr" className="text-xs">To</Label>
                <Input
                  id="to-addr"
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-9"
                  placeholder="client@example.com"
                />
              </div>
              <div>
                <Label htmlFor="cc-addr" className="text-xs">Cc</Label>
                <Input
                  id="cc-addr"
                  type="email"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  className="h-9"
                  placeholder=""
                />
              </div>
            </div>

            <div>
              <Label htmlFor="subj" className="text-xs">Subject</Label>
              <Input
                id="subj"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setDraftedByAi(false);
                }}
                className="h-9"
                placeholder={
                  language === "cs"
                    ? "Cenová nabídka …"
                    : "Quote …"
                }
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label htmlFor="bodyt" className="text-xs">Message</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  onClick={draftWithClaude}
                  disabled={drafting}
                >
                  <Bot size={12} />
                  {drafting ? "Drafting…" : "Draft with Claude (≈ $0.005)"}
                </Button>
              </div>
              <textarea
                id="bodyt"
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setDraftedByAi(false);
                }}
                rows={10}
                className="w-full rounded-md border border-input bg-background p-3 text-sm leading-relaxed"
                placeholder={
                  language === "cs"
                    ? "Dobrý den,\n\nzasílám cenovou nabídku…"
                    : "Hi,\n\nplease find the attached quote…"
                }
              />
              {draftedByAi && draftCost !== null && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Drafted by Claude · ${draftCost.toFixed(4)} this call
                </p>
              )}
              {aiErr && <p className="mt-1 text-xs text-red-700">{aiErr}</p>}
            </div>

            {sendErr && (
              <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                {sendErr}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                The PDF is attached automatically.
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={send}
                  disabled={sending || !identityId || !to.trim() || !subject.trim() || !body.trim()}
                >
                  {sending ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
