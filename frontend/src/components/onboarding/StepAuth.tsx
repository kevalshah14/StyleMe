"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type StepAuthProps = {
  onAuthenticated: () => void;
  onReturningUser: () => void;
};

export function StepAuth({ onAuthenticated, onReturningUser }: StepAuthProps) {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const { error: authError } = await authClient.signUp.email({
        email,
        password,
        name: "",
      });
      if (authError) {
        setError(authError.message ?? "Sign up failed.");
        return;
      }
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: authError } = await authClient.signIn.email({
        email,
        password,
      });
      if (authError) {
        setError(authError.message ?? "Sign in failed.");
        return;
      }
      // Check if returning user (already onboarded)
      const isOnboarded = typeof window !== "undefined" && localStorage.getItem("styleme_onboarded") === "true";
      if (isOnboarded) {
        onReturningUser();
      } else {
        onAuthenticated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      {/* Tab switcher */}
      <div className="flex rounded-base border-2 border-border overflow-hidden">
        <button
          type="button"
          className={cn(
            "flex-1 py-2.5 text-sm font-heading transition-colors",
            mode === "signup"
              ? "bg-main text-main-foreground"
              : "bg-secondary-background text-foreground hover:bg-main/10"
          )}
          onClick={() => { setMode("signup"); setError(null); }}
        >
          Sign Up
        </button>
        <button
          type="button"
          className={cn(
            "flex-1 py-2.5 text-sm font-heading border-l-2 border-border transition-colors",
            mode === "signin"
              ? "bg-main text-main-foreground"
              : "bg-secondary-background text-foreground hover:bg-main/10"
          )}
          onClick={() => { setMode("signin"); setError(null); }}
        >
          Sign In
        </button>
      </div>

      {mode === "signup" ? (
        <form onSubmit={handleSignUp} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signup-email">Email</Label>
            <Input
              id="signup-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signup-password">Password</Label>
            <Input
              id="signup-password"
              type="password"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signup-confirm">Confirm Password</Label>
            <Input
              id="signup-confirm"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <div className="rounded-base border-2 border-border bg-[#fff0f0] px-3 py-2 text-sm font-base text-foreground">
              {error}
            </div>
          )}
          <Button type="submit" disabled={loading} size="lg">
            {loading ? "Creating account…" : "Create Account"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleSignIn} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signin-email">Email</Label>
            <Input
              id="signin-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signin-password">Password</Label>
            <Input
              id="signin-password"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <div className="rounded-base border-2 border-border bg-[#fff0f0] px-3 py-2 text-sm font-base text-foreground">
              {error}
            </div>
          )}
          <Button type="submit" disabled={loading} size="lg">
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </form>
      )}
    </div>
  );
}
