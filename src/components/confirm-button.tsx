"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// Drop-in replacement for a destructive submit button that asks the user to
// confirm before submitting the parent form. Render it inside any <form
// action={serverAction}>; if the user confirms, the form submits naturally.
//
// We don't use window.confirm() because Next 16's React refresh boundaries
// occasionally lose focus through the native dialog; a small inline overlay
// is consistent and styleable.
export function ConfirmButton({
  label,
  confirmLabel,
  message,
  variant = "outline",
  size = "sm",
  className,
}: {
  label: string;
  confirmLabel?: string;
  message?: string;
  variant?: "outline" | "default" | "ghost" | "destructive";
  size?: "sm" | "default";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
      >
        {label}
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">{label}?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {message ?? "This can't be undone."}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={variant === "ghost" ? "outline" : variant}
                size="sm"
              >
                {confirmLabel ?? label}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
