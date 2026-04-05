"use client";

import { useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  auth: "Create your account",
  name: "What's your name?",
  photo: "Strike a pose",
  selfie: "Show us your face",
  complete: "All done!",
};

export function OnboardingFlow({ onComplete, initialStep = "auth" }: OnboardingFlowProps) {
  const [step, setStep] = useState<Step>(initialStep);
  const [displayName, setDisplayName] = useState("");
  const [fullBodyFile, setFullBodyFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const handleAuthComplete = useCallback(() => {
    setStep("name");
  }, []);

  const handleReturningUser = useCallback(() => {
    // Returning user who already onboarded — reload to pick up stored session
    // The AuthProvider will detect the onboarded flag and stored user
    window.location.reload();
  }, []);

  const handleNameNext = useCallback((name: string) => {
    setDisplayName(name);
    setStep("photo");
  }, []);

  const handlePhotoNext = useCallback(() => {
    setStep("selfie");
  }, []);

  const handleOnboardComplete = useCallback((u: User) => {
    setUser(u);
    setStep("complete");
  }, []);

  const handleEnter = useCallback(() => {
    if (user) onComplete(user);
  }, [user, onComplete]);

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-4">
            <span className="inline-block rounded-base border-2 border-border bg-main px-2.5 py-0.5 text-xs font-heading uppercase tracking-wider text-main-foreground">
              StyleMe
            </span>
          </div>
          {step !== "complete" && <ProgressBar currentStep={step} />}
          <CardTitle className="mt-4 text-2xl">{STEP_TITLES[step]}</CardTitle>
        </CardHeader>
        <CardContent>
          {step === "auth" && (
            <StepAuth
              onAuthenticated={handleAuthComplete}
              onReturningUser={handleReturningUser}
            />
          )}
          {step === "name" && (
            <StepName displayName={displayName} onNext={handleNameNext} />
          )}
          {step === "photo" && (
            <StepPhoto
              file={fullBodyFile}
              onFileSelect={setFullBodyFile}
              onNext={handlePhotoNext}
            />
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
        </CardContent>
      </Card>
    </div>
  );
}
