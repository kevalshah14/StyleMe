"use client";

import { useState } from "react";
import { PhotoDropzone } from "./PhotoDropzone";
import { onboard } from "@/lib/api";
import { setOnboarded } from "@/lib/auth";
import type { User } from "@/lib/types";

type StepSelfieProps = {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  displayName: string;
  fullBodyFile: File;
  onComplete: (user: User) => void;
};

export function StepSelfie({
  file,
  onFileSelect,
  displayName,
  fullBodyFile,
  onComplete,
}: StepSelfieProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFinish() {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const user = await onboard(displayName, fullBodyFile, file);
      setOnboarded();
      onComplete(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      <p className="text-xs font-medium text-neo-mute">
        A clear selfie helps us find you in group photos.
      </p>
      <PhotoDropzone
        file={file}
        onFileSelect={onFileSelect}
        label="Drop your selfie here"
        description="Face clearly visible, good lighting"
      />
      {error && (
        <div className="flex items-start gap-2 border-2 border-neo-border bg-neo-pink-soft p-3 animate-pop-in">
          <div className="mt-0.5 h-2 w-2 shrink-0 bg-neo-accent" />
          <p className="text-xs font-bold text-neo-ink">{error}</p>
        </div>
      )}
      <button
        type="button"
        disabled={!file || loading}
        onClick={handleFinish}
        className="neo-btn neo-btn-pink h-11 text-sm"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <div className="h-3.5 w-3.5 animate-spin border-2 border-white border-t-transparent rounded-full" />
            Setting up your profile…
          </span>
        ) : "Finish Setup"}
      </button>
    </div>
  );
}
