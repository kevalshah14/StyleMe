"use client";

import { PhotoDropzone } from "./PhotoDropzone";

type StepPhotoProps = {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  onNext: () => void;
};

export function StepPhoto({ file, onFileSelect, onNext }: StepPhotoProps) {
  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      <p className="text-xs font-medium text-neo-mute">
        Upload a full-length photo of yourself. We use this for virtual try-on.
      </p>
      <PhotoDropzone
        file={file}
        onFileSelect={onFileSelect}
        label="Drop your full-body photo"
        description="JPEG or PNG, full length so we can see your outfit style"
      />
      <button
        type="button"
        disabled={!file}
        onClick={onNext}
        className="neo-btn neo-btn-yellow h-11 text-sm"
      >
        Continue
      </button>
    </div>
  );
}
