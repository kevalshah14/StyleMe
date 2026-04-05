"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

  // Revoke object URL on cleanup or when preview changes
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
      <div className="flex flex-col items-center gap-4">
        <div className="relative rounded-base border-2 border-border shadow-shadow overflow-hidden">
          <img
            src={preview}
            alt="Preview"
            className="max-h-64 w-auto object-contain"
          />
        </div>
        <p className="text-sm font-base text-foreground/70">{file.name}</p>
        <Button
          variant="neutral"
          size="sm"
          type="button"
          onClick={() => {
            if (preview) URL.revokeObjectURL(preview);
            setPreview(null);
            onFileSelect(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
        >
          Change photo
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-base border-2 border-dashed border-border p-8 cursor-pointer transition-all",
        dragOver ? "bg-main/10 border-main scale-[1.02]" : "bg-secondary-background hover:bg-main/5"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <div className="text-4xl">📸</div>
      <p className="text-sm font-heading text-foreground">{label}</p>
      <p className="text-xs font-base text-foreground/50 text-center">{description}</p>
      <Button variant="neutral" size="sm" type="button">
        Choose file
      </Button>
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
