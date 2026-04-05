"use client";

import { login, onboard } from "@/lib/api";
import { clearToken, getToken, getUser, setUser as persistUser } from "@/lib/auth";
import type { User } from "@/lib/types";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

const fileInputClass =
  "text-sm text-neo-mute file:mr-3 file:cursor-pointer file:border-[3px] file:border-neo-ink file:bg-neo-yellow file:px-3 file:py-2 file:text-xs file:font-bold file:text-neo-ink file:shadow-[4px_4px_0_0_var(--neo-ink)] file:transition-transform hover:file:translate-x-0.5 hover:file:translate-y-0.5 hover:file:shadow-[2px_2px_0_0_var(--neo-ink)]";

type AuthContextValue = {
  user: User | null;
  ready: boolean;
  signIn: (user: User) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const signIn = useCallback((u: User) => {
    persistUser(u);
    localStorage.setItem("styleme_user_id", u.user_id);
    setUserState(u);
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    setUserState(null);
  }, []);

  useEffect(() => {
    const t = getToken();
    const u = getUser();
    if (t && u?.token === t && u.user_id) {
      setUserState(u);
    }
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center font-bold tracking-tight text-neo-ink">
        <div className="neo-card rounded-sm px-8 py-6 text-lg">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <OnboardingScreen onSuccess={signIn} />;
  }

  return (
    <AuthContext.Provider value={{ user, ready, signIn, signOut }}>{children}</AuthContext.Provider>
  );
}

function OnboardingScreen({ onSuccess }: { onSuccess: (u: User) => void }) {
  const [displayName, setDisplayName] = useState("");
  const [fullBody, setFullBody] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginId, setLoginId] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = displayName.trim();
    if (name.length < 1 || name.length > 50) {
      setError("Enter a name (1–50 characters).");
      return;
    }
    if (!fullBody || !selfie) {
      setError("Add both a full-length photo and a selfie.");
      return;
    }
    setLoading(true);
    try {
      const u = await onboard(name, fullBody, selfie);
      onSuccess(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete setup");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const id = loginId.trim();
    if (!id) {
      setError("Paste your user ID.");
      return;
    }
    setLoading(true);
    try {
      const u = await login(id);
      onSuccess(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="neo-card w-full max-w-md rounded-sm p-6 sm:p-8">
        <p className="inline-block border-[2px] border-neo-ink bg-neo-lime px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-neo-ink">
          StyleMe
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-neo-ink">Welcome aboard</h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-neo-mute">
          Your name plus a <span className="text-neo-ink">full-length</span> shot and a{" "}
          <span className="text-neo-ink">selfie</span>. We enroll your face for group photos and keep the body shot as
          reference.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="ob-name" className="text-sm font-bold text-neo-ink">
              Your name
            </label>
            <input
              id="ob-name"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="neo-input rounded-sm px-3 py-2.5 text-sm placeholder:text-neo-mute/60"
              placeholder="Alex"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="ob-full" className="text-sm font-bold text-neo-ink">
              Full-length photo
            </label>
            <input
              id="ob-full"
              type="file"
              accept="image/*"
              className={fileInputClass}
              onChange={(e) => setFullBody(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="ob-selfie" className="text-sm font-bold text-neo-ink">
              Selfie (face clearly visible)
            </label>
            <input
              id="ob-selfie"
              type="file"
              accept="image/*"
              className={fileInputClass}
              onChange={(e) => setSelfie(e.target.files?.[0] ?? null)}
            />
          </div>

          {error ? (
            <p className="border-[3px] border-neo-ink bg-neo-yellow/50 px-3 py-2 text-sm font-bold text-neo-ink shadow-[3px_3px_0_0_var(--neo-ink)]">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="neo-btn neo-btn-pink rounded-sm px-4 py-3 text-base disabled:translate-x-0 disabled:translate-y-0"
          >
            {loading ? "Setting up…" : "Start app →"}
          </button>
        </form>

        <div className="mt-8 border-t-[3px] border-neo-ink pt-6">
          <button
            type="button"
            onClick={() => {
              setShowLogin((v) => !v);
              setError(null);
            }}
            className="text-left text-sm font-bold text-neo-ink underline decoration-[3px] underline-offset-4 hover:bg-neo-yellow/40"
          >
            {showLogin ? "← New account setup" : "Already have an account? Sign in with user ID"}
          </button>
          {showLogin ? (
            <form onSubmit={handleLogin} className="mt-4 flex flex-col gap-3">
              <input
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="User ID (UUID)"
                className="neo-input rounded-sm px-3 py-2.5 font-mono text-xs placeholder:text-neo-mute/60"
              />
              <button
                type="submit"
                disabled={loading}
                className="neo-btn neo-btn-ghost rounded-sm px-3 py-2.5 text-sm disabled:translate-x-0 disabled:translate-y-0"
              >
                Sign in
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
