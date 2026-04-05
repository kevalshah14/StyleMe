"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
      <div className="flex flex-col gap-1">
        <p className="text-xs font-base text-foreground/50">
          A clear selfie helps us find you in group photos.
        </p>
      </div>
      <PhotoDropzone
        file={file}
        onFileSelect={onFileSelect}
        label="Drop your selfie here"
        description="Face clearly visible, good lighting"
      />
      {error && (
        <div className="rounded-base border-2 border-border bg-[#fff0f0] px-3 py-2 text-sm font-base text-foreground">
          {error}
        </div>
      )}
      <Button type="button" disabled={!file || loading} size="lg" onClick={handleFinish}>
        {loading ? "Setting up your profile…" : "Finish Setup"}
      </Button>
    </div>
  );
}
