"use client";

import { useState, type InputHTMLAttributes } from "react";
import { compressImages, filesToFileList } from "@/lib/image-compress";

// Drop-in replacement for <input type="file"> that transparently downscales
// large photos client-side before the form is submitted. Keeps the same
// `name`, so the Server Action receives FormData exactly as before — just
// smaller. Falls back to the original files if anything fails.
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> & {
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCompressingChange?: (busy: boolean) => void;
};

export function CompressingFileInput({
  onChange,
  onCompressingChange,
  ...rest
}: Props) {
  const [busy, setBusy] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const list = input.files;
    if (list && list.length > 0) {
      setBusy(true);
      onCompressingChange?.(true);
      try {
        const compressed = await compressImages(Array.from(list));
        input.files = filesToFileList(compressed);
      } finally {
        setBusy(false);
        onCompressingChange?.(false);
      }
    }
    onChange?.(e);
  };

  return (
    <input
      type="file"
      onChange={handleChange}
      data-compressing={busy || undefined}
      {...rest}
    />
  );
}
