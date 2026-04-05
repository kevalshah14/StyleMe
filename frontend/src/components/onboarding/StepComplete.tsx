"use client";

import { useEffect } from "react";

type StepCompleteProps = {
  displayName: string;
  onEnter: () => void;
};

export function StepComplete({ displayName, onEnter }: StepCompleteProps) {
  useEffect(() => {
    const timer = setTimeout(onEnter, 3500);
    return () => clearTimeout(timer);
  }, [onEnter]);

  return (
    <div className="flex flex-col items-center gap-6 py-4 animate-fade-in-up">
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center border-3 border-neo-border bg-neo-lime shadow-[5px_5px_0_0_var(--neo-shadow)] animate-pop-in">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="absolute -right-3 -top-2 h-5 w-5 rounded-full border-2 border-neo-border bg-neo-yellow animate-bounce-in" style={{ animationDelay: "0.2s" }} />
        <div className="absolute -bottom-2 -left-3 h-4 w-4 border-2 border-neo-border bg-neo-accent animate-bounce-in" style={{ animationDelay: "0.3s" }} />
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-black uppercase tracking-tight text-neo-ink">You&apos;re all set!</h2>
        <p className="mt-2 text-sm font-medium text-neo-mute">
          Welcome, <span className="font-extrabold text-neo-ink">{displayName}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={onEnter}
        className="neo-btn neo-btn-pink px-8 py-3 text-sm animate-bounce-in"
        style={{ animationDelay: "0.4s" }}
      >
        Enter StyleMe
      </button>
      <p className="text-[10px] font-bold uppercase text-neo-mute animate-pulse-soft">Auto-entering in 3s…</p>
    </div>
  );
}
