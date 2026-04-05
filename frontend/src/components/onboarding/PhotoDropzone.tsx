"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PhotoDropzoneProps = {
  onFileSelect: (file: File | null) => void;
  file: File | null;
  label: string;
  description: string;
};

export function PhotoDropzone({ onFileSelect, file, label, description }: PhotoDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleFile = useCallback(
    (f: File) => {
      if (!f.type.startsWith("image/")) return;
      onFileSelect(f);
      if (preview) URL.revokeObjectURL(preview);
      const url = URL.createObjectURL(f);
      setPreview(url);
    },
    [onFileSelect, preview]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  if (preview && file) {
    return (
      <div className="flex flex-col items-center gap-4 animate-scale-in">
        <div className="relative overflow-hidden border-3 border-neo-border shadow-[4px_4px_0_0_var(--neo-shadow)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Preview"
            className="max-h-64 w-auto object-contain"
          />
          <div className="absolute left-0 top-0 h-1 w-full bg-linear-to-r from-neo-accent via-neo-yellow to-neo-blue" />
        </div>
        <p className="text-xs font-bold text-neo-mute">{file.name}</p>
        <button
          type="button"
          onClick={() => {
            if (preview) URL.revokeObjectURL(preview);
            setPreview(null);
            onFileSelect(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
          className="border-2 border-neo-border bg-neo-surface px-4 py-2 text-xs font-extrabold uppercase text-neo-ink shadow-[3px_3px_0_0_var(--neo-shadow)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_0_var(--neo-shadow)]"
        >
          Change photo
        </button>
      </div>
    );
  }

  return (
    <div
      className={`drop-zone flex flex-col items-center justify-center gap-4 p-8 cursor-pointer ${
        dragOver ? "dragging" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <div className="relative">
        <div className="flex h-14 w-14 items-center justify-center border-3 border-neo-border bg-neo-blue shadow-[3px_3px_0_0_var(--neo-shadow)]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
        <div className="absolute -bottom-1 -right-2 h-4 w-4 rounded-full border-2 border-neo-border bg-neo-yellow animate-pulse-soft" />
      </div>
      <div className="text-center">
        <p className="text-sm font-extrabold uppercase text-neo-ink">{label}</p>
        <p className="mt-1 text-[11px] text-neo-mute">{description}</p>
      </div>
      <span className="border-2 border-neo-border bg-neo-surface px-4 py-2 text-xs font-extrabold uppercase text-neo-ink shadow-[3px_3px_0_0_var(--neo-shadow)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_0_var(--neo-shadow)]">
        Choose file
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
