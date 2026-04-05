"use client";

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

const STEP_COLORS = [
  "bg-neo-accent",
  "bg-neo-yellow",
  "bg-neo-blue",
  "bg-neo-lime",
];

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
              className={`h-2 w-full border-2 border-neo-border transition-all duration-500 ${
                isCompleted ? STEP_COLORS[i] : isActive ? `${STEP_COLORS[i]} opacity-50` : "bg-neo-bg"
              }`}
              style={isCompleted ? { animation: "fillBar 0.4s ease-out forwards" } : undefined}
            />
            <span
              className={`text-[10px] font-extrabold uppercase tracking-wider transition-colors ${
                isCompleted ? "text-neo-ink" : isActive ? "text-neo-ink" : "text-neo-mute/50"
              }`}
            >
              {isCompleted ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="inline">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
