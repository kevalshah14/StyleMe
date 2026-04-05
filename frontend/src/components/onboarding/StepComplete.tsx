"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

type StepCompleteProps = {
  displayName: string;
  onEnter: () => void;
};

export function StepComplete({ displayName, onEnter }: StepCompleteProps) {
  useEffect(() => {
    const timer = setTimeout(onEnter, 3000);
    return () => clearTimeout(timer);
  }, [onEnter]);

  return (
    <div className="flex flex-col items-center gap-6 py-4 animate-fade-in-up">
      <div className="text-6xl animate-bounce">✨</div>
      <div className="text-center">
        <h2 className="text-2xl font-heading text-foreground">You&apos;re all set!</h2>
        <p className="mt-2 text-sm font-base text-foreground/60">
          Welcome, <span className="font-heading text-foreground">{displayName}</span>
        </p>
      </div>
      <Button size="lg" onClick={onEnter}>
        Enter StyleMe
      </Button>
    </div>
  );
}
