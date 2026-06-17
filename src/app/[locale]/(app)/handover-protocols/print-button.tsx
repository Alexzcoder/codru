"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        background: "#111",
        color: "white",
        padding: "6px 14px",
        borderRadius: 6,
        fontSize: 13,
      }}
    >
      {label}
    </button>
  );
}
