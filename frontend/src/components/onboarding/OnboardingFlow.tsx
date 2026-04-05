"use client";

import { useCallback, useState } from "react";
import { getUser } from "@/lib/auth";
import { ProgressBar } from "./ProgressBar";
import { StepAuth } from "./StepAuth";
import { StepName } from "./StepName";
import { StepPhoto } from "./StepPhoto";
import { StepSelfie } from "./StepSelfie";
import { StepComplete } from "./StepComplete";
import type { User } from "@/lib/types";

type Step = "auth" | "name" | "photo" | "selfie" | "complete";

type OnboardingFlowProps = {
  onComplete: (user: User) => void;
  initialStep?: Step;
};

const STEP_TITLES: Record<Step, string> = {
  auth: "Create Account",
  name: "Your Name",
  photo: "Strike a Pose",
  selfie: "Show Your Face",
  complete: "All Set!",
};

const STEP_SUBTITLES: Record<Step, string> = {
  auth: "Let's get you started with StyleMe",
  name: "What should we call you?",
  photo: "We'll use this for virtual try-on",
  selfie: "Helps us find you in photos",
  complete: "Your wardrobe awaits",
};

export function OnboardingFlow({ onComplete, initialStep = "auth" }: OnboardingFlowProps) {
  const [step, setStep] = useState<Step>(initialStep);
  const [displayName, setDisplayName] = useState("");
  const [fullBodyFile, setFullBodyFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const handleAuthComplete = useCallback(() => { setStep("name"); }, []);

  const handleReturningUser = useCallback(() => {
    const storedUser = getUser();
    if (storedUser) onComplete(storedUser);
    else setStep("name");
  }, [onComplete]);

  const handleNameNext = useCallback((name: string) => {
    setDisplayName(name);
    setStep("photo");
  }, []);

  const handlePhotoNext = useCallback(() => { setStep("selfie"); }, []);

  const handleOnboardComplete = useCallback((u: User) => {
    setUser(u);
    setStep("complete");
  }, []);

  const handleEnter = useCallback(() => {
    if (user) onComplete(user);
  }, [user, onComplete]);

  return (
    <div className="relative flex min-h-full flex-1 items-center justify-center bg-neo-bg px-4 py-12 overflow-hidden">
      {/* Decorative floating shapes */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[8%] top-[15%] h-12 w-12 border-3 border-neo-border/20 bg-neo-accent/10 animate-float" />
        <div className="absolute right-[12%] top-[20%] h-10 w-10 rounded-full border-3 border-neo-border/20 bg-neo-yellow/15 animate-float-alt" />
        <div className="absolute bottom-[18%] left-[15%] h-8 w-8 rounded-full border-2 border-neo-border/15 bg-neo-blue/10 animate-float" style={{ animationDelay: "1s" }} />
        <div className="absolute bottom-[25%] right-[10%] h-6 w-6 border-2 border-neo-border/15 bg-neo-lime/10 animate-float-alt" style={{ animationDelay: "0.5s" }} />
      </div>

      <div className="relative w-full max-w-md animate-pop-in">
        <div className="border-3 border-neo-border bg-neo-surface shadow-[8px_8px_0_0_var(--neo-shadow)]">
          <div className="border-b-3 border-neo-border p-6">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 border-2 border-neo-border bg-neo-accent" />
              <div className="h-4 w-4 rounded-full border-2 border-neo-border bg-neo-yellow" />
              <div className="h-4 w-4 border-2 border-neo-border bg-neo-blue" style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }} />
              <span className="ml-1 text-[10px] font-extrabold uppercase tracking-widest text-neo-mute">StyleMe</span>
            </div>
            {step !== "complete" && <div className="mt-4"><ProgressBar currentStep={step} /></div>}
            <h2 className="mt-4 text-2xl font-black uppercase tracking-tight text-neo-ink">{STEP_TITLES[step]}</h2>
            <p className="mt-1 text-xs font-medium text-neo-mute">{STEP_SUBTITLES[step]}</p>
          </div>
          <div className="p-6">
            {step === "auth" && (
              <StepAuth onAuthenticated={handleAuthComplete} onReturningUser={handleReturningUser} />
            )}
            {step === "name" && (
              <StepName displayName={displayName} onNext={handleNameNext} />
            )}
            {step === "photo" && (
              <StepPhoto file={fullBodyFile} onFileSelect={setFullBodyFile} onNext={handlePhotoNext} />
            )}
            {step === "selfie" && fullBodyFile && (
              <StepSelfie
                file={selfieFile}
                onFileSelect={setSelfieFile}
                displayName={displayName}
                fullBodyFile={fullBodyFile}
                onComplete={handleOnboardComplete}
              />
            )}
            {step === "complete" && user && (
              <StepComplete displayName={displayName} onEnter={handleEnter} />
            )}
          </div>
        </div>

        {/* Decorative accent bar at bottom */}
        <div className="mt-0 flex h-2">
          <div className="flex-1 bg-neo-accent" />
          <div className="flex-1 bg-neo-yellow" />
          <div className="flex-1 bg-neo-blue" />
          <div className="flex-1 bg-neo-lime" />
        </div>
      </div>
    </div>
  );
}
