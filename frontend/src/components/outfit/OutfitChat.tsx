"use client";

import { AppNav } from "@/components/AppNav";
import { useAuth } from "@/components/auth/AuthProvider";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type WardrobeItem = {
  garment_id: string;
  garment_type: string;
  primary_color: string;
  description: string;
  image_base64: string;
};

type ChatMsg = {
  role: "user" | "assistant";
  text: string;
  matches?: WardrobeItem[];
  totalWardrobe?: number;
  searchMethod?: string;
};

const SUGGESTIONS = [
  { text: "Casual Friday office look", icon: "briefcase" },
  { text: "Outfit for a dinner date", icon: "heart" },
  { text: "Job interview — professional but not stiff", icon: "star" },
  { text: "Something warm for rainy weather", icon: "cloud" },
  { text: "Summer brunch outfit", icon: "sun" },
  { text: "What goes with a navy blazer?", icon: "search" },
] as const;

function SuggestionIcon({ name }: { name: string }) {
  const props = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "briefcase": return <svg {...props}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>;
    case "heart": return <svg {...props}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>;
    case "star": return <svg {...props}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>;
    case "cloud": return <svg {...props}><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" /></svg>;
    case "sun": return <svg {...props}><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>;
    case "search": return <svg {...props}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
    default: return null;
  }
}

export function OutfitChat() {
  const { user } = useAuth();
  const [userId, setUserId] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.user_id) {
      setUserId(user.user_id);
      localStorage.setItem("styleme_user_id", user.user_id);
    }
  }, [user?.user_id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    if (!text.trim() || !userId) return;
    const trimmed = text.trim();
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, message: trimmed }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: data.reply,
            matches: data.matches || [],
            totalWardrobe: data.total_wardrobe,
            searchMethod: String(data.search_method || ""),
          },
        ]);
      } else {
        const raw = await res.text();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: `Could not get suggestions.${raw ? ` (${raw.slice(0, 120)})` : ""}` },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `Could not reach the API at ${API_BASE}. Is the backend running?` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-neo-bg">
      <AppNav />
      <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 sm:px-6">
        {/* ── Empty hero state ── */}
        {messages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-8 pb-32 pt-8 text-center">
            <div className="relative">
              <div className="animate-float">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border-3 border-neo-border bg-neo-accent shadow-[5px_5px_0_0_var(--neo-shadow)]">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 3h12l3 6-9 13L3 9z" />
                  </svg>
                </div>
              </div>
              <div className="absolute -right-8 -top-4 h-6 w-6 rotate-12 rounded-md border-2 border-neo-border bg-neo-yellow shadow-[2px_2px_0_0_var(--neo-shadow)]" />
              <div className="absolute -bottom-3 -left-6 h-5 w-5 -rotate-12 rounded-full border-2 border-neo-border bg-neo-lime shadow-[2px_2px_0_0_var(--neo-shadow)]" />
            </div>

            <div className="max-w-lg">
              <h1 className="text-3xl font-bold tracking-tight text-neo-ink sm:text-4xl">
                What&apos;s the <span className="inline-block -rotate-1 rounded-lg bg-neo-yellow px-2 py-0.5 text-neo-on-color">occasion</span>?
              </h1>
              <p className="mx-auto mt-4 max-w-md text-sm font-medium leading-relaxed text-neo-mute sm:text-base">
                Describe what you need and we&apos;ll find matching pieces from your wardrobe.
              </p>
            </div>

            <div className="flex max-w-xl flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={s.text}
                  type="button"
                  onClick={() => sendMessage(s.text)}
                  className="neo-tag neo-press flex items-center gap-2 px-3.5 py-2.5 text-left text-xs font-bold text-neo-ink opacity-0 animate-fade-in-up"
                  style={{ animationDelay: `${i * 0.07}s`, animationFillMode: "forwards" }}
                >
                  <span className="text-neo-mute">
                    <SuggestionIcon name={s.icon} />
                  </span>
                  {s.text}
                </button>
              ))}
            </div>

            <p className="mt-2 text-xs font-medium text-neo-mute">
              No clothes yet?{" "}
              <Link href="/upload" className="font-bold text-neo-accent underline decoration-2 underline-offset-2 hover:text-neo-ink">
                Upload some first
              </Link>
            </p>
          </div>
        )}

        {/* ── Messages ── */}
        {messages.length > 0 && (
          <div className="flex flex-1 flex-col gap-5 pb-28 pt-6">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col gap-3 ${msg.role === "user" ? "animate-slide-in-right items-end" : "animate-slide-in-left items-start"}`}
              >
                <div className={`flex max-w-[88%] gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  {/* Avatar */}
                  <div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-neo-border shadow-[2px_2px_0_0_var(--neo-shadow)] ${
                    msg.role === "user" ? "bg-neo-lime" : "bg-neo-accent"
                  }`}>
                    {msg.role === "user" ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--neo-on-color)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 3h12l3 6-9 13L3 9z" />
                      </svg>
                    )}
                  </div>

                  {/* Bubble */}
                  <div
                    className={`rounded-xl border-2 border-neo-border px-4 py-3 shadow-[3px_3px_0_0_var(--neo-shadow)] ${
                      msg.role === "user"
                        ? "bg-neo-lime-soft"
                        : "bg-neo-surface"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-neo-ink">{msg.text}</p>
                  </div>
                </div>

                {/* Match cards */}
                {msg.matches && msg.matches.length > 0 && (
                  <div className={`w-full max-w-[88%] ${msg.role === "user" ? "pr-10" : "pl-10"}`}>
                    <div className="stagger-grid grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {msg.matches.map((item) => (
                        <div key={item.garment_id} className="neo-card-interactive overflow-hidden">
                          {item.image_base64 ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.image_base64}
                              alt={item.garment_type}
                              className="aspect-square w-full bg-neo-bg object-contain"
                            />
                          ) : (
                            <div className="flex aspect-square w-full items-center justify-center bg-neo-bg">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-neo-mute/40">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <path d="m21 15-5-5L5 21" />
                              </svg>
                            </div>
                          )}
                          <div className="p-2.5">
                            <p className="truncate text-xs font-bold capitalize text-neo-ink">
                              {item.garment_type}
                            </p>
                            <p className="text-[10px] font-medium text-neo-mute">{item.primary_color}</p>
                            {item.description && (
                              <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-neo-mute">{item.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {msg.totalWardrobe != null && (
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-neo-mute">
                        {msg.matches.length} match{msg.matches.length === 1 ? "" : "es"} from {msg.totalWardrobe} items
                        {msg.searchMethod ? (
                          <span className="ml-2 rounded-md border border-neo-border/50 bg-neo-surface px-1.5 py-0.5 text-[9px] font-bold normal-case">{msg.searchMethod}</span>
                        ) : null}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="animate-fade-in flex items-start gap-2.5">
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-neo-border bg-neo-accent shadow-[2px_2px_0_0_var(--neo-shadow)]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 3h12l3 6-9 13L3 9z" />
                  </svg>
                </div>
                <div className="rounded-xl border-2 border-neo-border bg-neo-yellow-soft px-4 py-3 shadow-[3px_3px_0_0_var(--neo-shadow)]">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-neo-mute" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-neo-mute [animation-delay:0.15s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-neo-mute [animation-delay:0.3s]" />
                    </span>
                    <span className="text-xs font-bold text-neo-ink">Searching your wardrobe…</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {/* ── Composer bar ── */}
        <div className="composer-bar fixed inset-x-0 bottom-0 z-30 border-t-2 border-neo-border px-4 py-3 sm:px-6">
          <form onSubmit={onSubmit} className="mx-auto flex max-w-3xl gap-2.5">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe what you want to wear…"
                className="neo-input h-12 w-full rounded-xl px-4 pr-10 text-sm placeholder:text-neo-mute/50"
                disabled={loading}
                autoComplete="off"
              />
              <svg
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-neo-mute/40"
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="neo-btn neo-btn-pink flex h-12 items-center gap-2 rounded-xl px-5 text-sm font-bold disabled:cursor-not-allowed"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
