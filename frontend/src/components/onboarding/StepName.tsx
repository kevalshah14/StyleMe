"use client";

import { useState } from "react";

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
        <label htmlFor="display-name" className="text-xs font-extrabold uppercase tracking-wider text-neo-ink">
          Your display name
        </label>
        <input
          id="display-name"
          placeholder="e.g. Alex"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="neo-input h-11 px-4 text-sm"
        />
        <p className="text-[10px] font-bold uppercase text-neo-mute">1–50 characters</p>
      </div>
      <button
        type="submit"
        disabled={!isValid}
        className="neo-btn neo-btn-yellow h-11 text-sm"
      >
        Continue
      </button>
    </form>
  );
}
