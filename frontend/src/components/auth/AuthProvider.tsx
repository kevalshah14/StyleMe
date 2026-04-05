"use client";

import { authClient } from "@/lib/auth-client";
import { clearToken, getToken, getUser, isOnboarded, setUser as persistUser } from "@/lib/auth";
import type { User } from "@/lib/types";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

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
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const { data: session, isPending: sessionLoading } = authClient.useSession();

  const signIn = useCallback((u: User) => {
    persistUser(u);
    localStorage.setItem("styleme_user_id", u.user_id);
    setUserState(u);
    setNeedsOnboarding(false);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authClient.signOut();
    } catch {
      // Better Auth signout may fail if no session — that's fine
    }
    clearToken();
    setUserState(null);
    setNeedsOnboarding(false);
  }, []);

  useEffect(() => {
    if (sessionLoading) return;

    const token = getToken();
    const storedUser = getUser();
    const onboarded = isOnboarded();

    if (onboarded && token && storedUser?.user_id) {
      // Returning user: has completed onboarding and has a stored FastAPI token.
      // Restore regardless of Better Auth session state (session cookie may expire
      // independently of the FastAPI JWT).
      setUserState(storedUser);
      setReady(true);
    } else if (session && !onboarded) {
      // Has Better Auth session but hasn't completed onboarding yet
      setNeedsOnboarding(true);
      setReady(true);
    } else {
      // No stored credentials — needs full onboarding
      setNeedsOnboarding(true);
      setReady(true);
    }
  }, [session, sessionLoading]);

  if (!ready) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center bg-neo-bg">
        <div className="flex flex-col items-center gap-5 animate-fade-in">
          <div className="relative flex items-center gap-3">
            <div className="h-8 w-8 border-3 border-neo-border bg-neo-accent animate-bounce-in" style={{ animationDelay: "0s" }} />
            <div className="h-8 w-8 rounded-full border-3 border-neo-border bg-neo-yellow animate-bounce-in" style={{ animationDelay: "0.1s" }} />
            <div className="h-8 w-8 border-3 border-neo-border bg-neo-blue animate-bounce-in" style={{ animationDelay: "0.2s" }} />
            <div className="absolute -bottom-2 -right-3 h-3 w-3 rounded-full bg-neo-lime animate-pulse-soft" />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-sm font-black uppercase tracking-widest text-neo-ink">
              Style<span className="text-neo-accent">Me</span>
            </p>
            <div className="h-1 w-16 overflow-hidden bg-neo-bg">
              <div
                className="h-full w-full animate-gradient"
                style={{ background: "linear-gradient(to right, var(--neo-accent), var(--neo-yellow), var(--neo-blue))", backgroundSize: "200% 200%" }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user && needsOnboarding) {
    const initialStep = session ? "name" : "auth";
    return <OnboardingFlow onComplete={signIn} initialStep={initialStep} />;
  }

  if (!user) {
    return <OnboardingFlow onComplete={signIn} />;
  }

  return (
    <AuthContext.Provider value={{ user, ready, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
