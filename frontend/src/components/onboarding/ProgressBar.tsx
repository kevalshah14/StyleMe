"use client";

import { cn } from "@/lib/utils";

const STEPS = ["Account", "Name", "Photo", "Selfie"] as const;

type ProgressBarProps = {
  currentStep: "auth" | "name" | "photo" | "selfie" | "complete";
};

const STEP_MAP: Record<string, number> = {
  auth: 0,
  name: 1,
  photo: 2,
  selfie: 3,
  complete: 4,
};

export function ProgressBar({ currentStep }: ProgressBarProps) {
  const currentIndex = STEP_MAP[currentStep] ?? 0;

  return (
    <div className="flex items-center gap-2 w-full">
      {STEPS.map((label, i) => {
        const isCompleted = i < currentIndex;
        const isActive = i === currentIndex;

        return (
          <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
            <div
              className={cn(
                "h-2 w-full rounded-base border-2 border-border transition-all duration-300",
                isCompleted && "bg-main",
                isActive && "bg-main/60",
                !isCompleted && !isActive && "bg-secondary-background"
              )}
            />
            <span
              className={cn(
                "text-xs font-heading transition-colors",
                (isCompleted || isActive) ? "text-foreground" : "text-foreground/40"
              )}
            >
              {isCompleted ? "✓" : label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
