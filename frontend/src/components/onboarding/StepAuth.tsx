"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { isOnboarded as checkOnboarded } from "@/lib/auth";

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
      if (checkOnboarded()) {
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
      <div className="flex overflow-hidden border-3 border-neo-border">
        <button
          type="button"
          className={`flex-1 py-2.5 text-xs font-extrabold uppercase tracking-wider transition-all ${
            mode === "signup"
              ? "bg-neo-accent text-white"
              : "bg-neo-surface text-neo-mute hover:text-neo-ink hover:bg-neo-yellow-soft"
          }`}
          onClick={() => { setMode("signup"); setError(null); }}
        >
          Sign Up
        </button>
        <button
          type="button"
          className={`flex-1 py-2.5 text-xs font-extrabold uppercase tracking-wider border-l-3 border-neo-border transition-all ${
            mode === "signin"
              ? "bg-neo-accent text-white"
              : "bg-neo-surface text-neo-mute hover:text-neo-ink hover:bg-neo-yellow-soft"
          }`}
          onClick={() => { setMode("signin"); setError(null); }}
        >
          Sign In
        </button>
      </div>

      {mode === "signup" ? (
        <form onSubmit={handleSignUp} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="signup-email" className="text-xs font-extrabold uppercase tracking-wider text-neo-ink">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="neo-input h-11 px-4 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="signup-password" className="text-xs font-extrabold uppercase tracking-wider text-neo-ink">
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="neo-input h-11 px-4 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="signup-confirm" className="text-xs font-extrabold uppercase tracking-wider text-neo-ink">
              Confirm Password
            </label>
            <input
              id="signup-confirm"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="neo-input h-11 px-4 text-sm"
            />
          </div>
          {error && (
            <div className="flex items-start gap-2 border-2 border-neo-border bg-neo-pink-soft p-3 animate-pop-in">
              <div className="mt-0.5 h-2 w-2 shrink-0 bg-neo-accent" />
              <p className="text-xs font-bold text-neo-ink">{error}</p>
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="neo-btn neo-btn-pink h-11 text-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-3.5 w-3.5 animate-spin border-2 border-white border-t-transparent rounded-full" />
                Creating account…
              </span>
            ) : "Create Account"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSignIn} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="signin-email" className="text-xs font-extrabold uppercase tracking-wider text-neo-ink">
              Email
            </label>
            <input
              id="signin-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="neo-input h-11 px-4 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="signin-password" className="text-xs font-extrabold uppercase tracking-wider text-neo-ink">
              Password
            </label>
            <input
              id="signin-password"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="neo-input h-11 px-4 text-sm"
            />
          </div>
          {error && (
            <div className="flex items-start gap-2 border-2 border-neo-border bg-neo-pink-soft p-3 animate-pop-in">
              <div className="mt-0.5 h-2 w-2 shrink-0 bg-neo-accent" />
              <p className="text-xs font-bold text-neo-ink">{error}</p>
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="neo-btn neo-btn-pink h-11 text-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-3.5 w-3.5 animate-spin border-2 border-white border-t-transparent rounded-full" />
                Signing in…
              </span>
            ) : "Sign In"}
          </button>
        </form>
      )}
    </div>
  );
}
