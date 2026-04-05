"use client";

import { Button } from "@/components/ui/button";
import { PhotoDropzone } from "./PhotoDropzone";

type StepPhotoProps = {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  onNext: () => void;
};

export function StepPhoto({ file, onFileSelect, onNext }: StepPhotoProps) {
  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-base text-foreground/50">
          Upload a full-length photo of yourself. We use this for virtual try-on.
        </p>
      </div>
      <PhotoDropzone
        file={file}
        onFileSelect={onFileSelect}
        label="Drop your full-body photo here"
        description="JPEG or PNG, full length so we can see your outfit style"
      />
      <Button type="button" disabled={!file} size="lg" onClick={onNext}>
        Continue
      </Button>
    </div>
  );
}
