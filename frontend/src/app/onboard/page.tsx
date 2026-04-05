"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { register } from "@/lib/api";

export default function OnboardPage() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const user = await register(name.trim());
      login(user);
      router.push("/upload");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-24">
      <div className="w-full max-w-md">
        <div className="bg-surface rounded-2xl shadow-sm border border-border p-8">
          <h1 className="text-2xl font-bold text-center mb-2">Welcome to StyleMe</h1>
          <p className="text-text-secondary text-center text-sm mb-8">
            Let&apos;s get to know you.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1.5">
                What should we call you?
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={50}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition"
                autoFocus
              />
            </div>

            {error && <p className="text-sm text-error">{error}</p>}

            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="w-full py-2.5 bg-accent text-white font-semibold rounded-full hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? "Setting up..." : "Let's Style You"}
            </button>
          </form>

          <p className="mt-6 text-xs text-text-secondary text-center">
            Your wardrobe data is private and only visible to you.
          </p>
        </div>
      </div>
    </div>
  );
}
