"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StepNameProps = {
  displayName: string;
  onNext: (name: string) => void;
};

export function StepName({ displayName, onNext }: StepNameProps) {
  const [name, setName] = useState(displayName);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length >= 1 && trimmed.length <= 50) {
      onNext(trimmed);
    }
  }

  const isValid = name.trim().length >= 1 && name.trim().length <= 50;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 animate-fade-in-up">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="display-name">What should we call you?</Label>
        <Input
          id="display-name"
          placeholder="Alex"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <p className="text-xs font-base text-foreground/50">1–50 characters</p>
      </div>
      <Button type="submit" disabled={!isValid} size="lg">
        Continue
      </Button>
    </form>
  );
}
