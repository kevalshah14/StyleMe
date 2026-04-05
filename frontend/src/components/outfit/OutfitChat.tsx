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
  tryOnImage?: string;
  tryOnLoading?: boolean;
  tryOnError?: string;
  selectedIds?: Set<string>;
};

const SUGGESTIONS = [
  "Casual Friday office look",
  "Outfit for a dinner date",
  "Job interview — sharp but relaxed",
  "Something warm for rainy weather",
  "Summer brunch outfit",
  "What goes with a navy blazer?",
];

const CHIP_COLORS = [
  "hover:bg-neo-pink-soft",
  "hover:bg-neo-yellow-soft",
  "hover:bg-neo-cyan-soft",
  "hover:bg-neo-lime-soft",
  "hover:bg-neo-peach",
  "hover:bg-neo-lavender",
];

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
        const matches: WardrobeItem[] = data.matches || [];
        const msgIndex = messages.length + 1;
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: data.reply,
            matches,
            totalWardrobe: data.total_wardrobe,
            searchMethod: String(data.search_method || ""),
            tryOnLoading: matches.length > 0,
          },
        ]);
        setLoading(false);
        if (matches.length > 0) triggerTryOn(msgIndex, matches, trimmed);
        return;
      } else {
        const raw = await res.text();
        setMessages((prev) => [...prev, { role: "assistant", text: `Error.${raw ? ` (${raw.slice(0, 120)})` : ""}` }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: `Cannot reach API at ${API_BASE}.` }]);
    } finally {
      setLoading(false);
    }
  }

  async function triggerTryOn(msgIndex: number, matches: WardrobeItem[], query: string) {
    try {
      const garmentIds = matches.map((m) => m.garment_id);
      const res = await fetch(`${API_BASE}/api/try-on/wardrobe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, garment_ids: garmentIds, query }),
      });
      if (res.ok) {
        const data = await res.json();
        const selectedIds = new Set<string>(data.selected_garment_ids ?? garmentIds);
        setMessages((prev) =>
          prev.map((m, i) => i === msgIndex ? { ...m, tryOnImage: data.generated_image, tryOnLoading: false, selectedIds } : m),
        );
      } else {
        const detail = (await res.json().catch(() => null)) as { detail?: string } | null;
        setMessages((prev) =>
          prev.map((m, i) => i === msgIndex ? { ...m, tryOnLoading: false, tryOnError: detail?.detail || "Try-on failed" } : m),
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m, i) => i === msgIndex ? { ...m, tryOnLoading: false, tryOnError: "Could not generate try-on" } : m),
      );
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
        {/* Hero */}
        {messages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-10 pb-32 pt-8">
            {/* Playful geometric composition */}
            <div className="relative flex items-center justify-center">
              <div className="animate-spin-slow absolute h-44 w-44 rounded-full border-3 border-dashed border-neo-border/15" />
              <div className="relative z-10 flex items-center gap-4">
                <div className="h-16 w-16 border-3 border-neo-border bg-neo-accent shadow-[4px_4px_0_0_var(--neo-shadow)] animate-bounce-in" />
                <div className="h-16 w-16 rounded-full border-3 border-neo-border bg-neo-yellow shadow-[4px_4px_0_0_var(--neo-shadow)] animate-bounce-in" style={{ animationDelay: "0.1s" }} />
                <div className="flex h-16 w-16 items-center justify-center border-3 border-neo-border bg-neo-blue shadow-[4px_4px_0_0_var(--neo-shadow)] animate-bounce-in" style={{ animationDelay: "0.2s" }}>
                  <div style={{ width: 0, height: 0, borderLeft: "14px solid transparent", borderRight: "14px solid transparent", borderBottom: "24px solid white" }} />
                </div>
              </div>
              <div className="absolute -bottom-3 -right-6 h-6 w-6 border-2 border-neo-border bg-neo-lime animate-float" />
              <div className="absolute -left-5 -top-3 h-5 w-5 rounded-full border-2 border-neo-border bg-neo-accent/60 animate-float-alt" />
              <div className="absolute -bottom-1 left-2 h-3 w-3 rounded-full bg-neo-yellow/40 animate-pulse-soft" />
            </div>

            <div className="max-w-lg text-center">
              <h1 className="text-4xl font-black uppercase tracking-tight text-neo-ink sm:text-5xl">
                What&apos;s the{" "}
                <span className="relative inline-block -rotate-2 border-3 border-neo-border bg-neo-yellow px-3 py-1 text-neo-on-color shadow-[3px_3px_0_0_var(--neo-shadow)]">
                  Occasion
                  <div className="absolute -right-2 -top-2 h-3 w-3 rounded-full bg-neo-accent" />
                </span>
                ?
              </h1>
              <p className="mx-auto mt-5 max-w-sm text-sm font-medium leading-relaxed text-neo-mute">
                Describe what you need. We&apos;ll find the perfect outfit from your wardrobe and show you how it looks.
              </p>
            </div>

            {/* Suggestion chips */}
            <div className="flex max-w-xl flex-wrap justify-center gap-2.5">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => sendMessage(s)}
                  className={`neo-tag neo-press px-4 py-2.5 text-xs font-bold text-neo-ink opacity-0 animate-fade-in-up ${CHIP_COLORS[i % CHIP_COLORS.length]}`}
                  style={{ animationDelay: `${i * 0.07}s`, animationFillMode: "forwards" }}
                >
                  {s}
                </button>
              ))}
            </div>

            <span className="flex items-center gap-2 text-xs font-medium text-neo-mute">
              <span className="h-1.5 w-1.5 rounded-full bg-neo-accent animate-pulse-soft" />
              No clothes yet?{" "}
              <Link href="/upload" className="font-extrabold uppercase text-neo-accent underline decoration-2 underline-offset-2 hover:text-neo-ink transition-colors">
                Upload first
              </Link>
            </span>
          </div>
        )}

        {/* Messages */}
        {messages.length > 0 && (
          <div className="flex flex-1 flex-col gap-5 pb-28 pt-6">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col gap-3 ${msg.role === "user" ? "animate-slide-in-right items-end" : "animate-slide-in-left items-start"}`}
              >
                <div className={`flex max-w-[88%] gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  {/* Avatar */}
                  <div className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center border-2 border-neo-border shadow-[2px_2px_0_0_var(--neo-shadow)] transition-transform hover:scale-105 ${
                    msg.role === "user" ? "rounded-full bg-neo-yellow" : "bg-neo-accent"
                  }`}>
                    {msg.role === "user" ? (
                      <span className="text-sm font-black text-neo-on-color">U</span>
                    ) : (
                      <div className="h-3 w-3 rounded-full bg-white" />
                    )}
                  </div>

                  {/* Bubble */}
                  <div className={`border-3 border-neo-border px-4 py-3 shadow-[3px_3px_0_0_var(--neo-shadow)] ${
                    msg.role === "user" ? "bg-neo-yellow-soft" : "bg-neo-surface"
                  }`}>
                    <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-neo-ink">{msg.text}</p>
                  </div>
                </div>

                {/* Match cards + try-on */}
                {msg.matches && msg.matches.length > 0 && (
                  <div className={`w-full max-w-[88%] ${msg.role === "user" ? "pr-12" : "pl-12"}`}>
                    {msg.tryOnImage && (
                      <div className="animate-pop-in mb-3 overflow-hidden border-3 border-neo-border shadow-[5px_5px_0_0_var(--neo-shadow)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={msg.tryOnImage} alt="Virtual try-on" className="w-full bg-black object-contain" />
                        <div className="flex items-center gap-2 border-t-2 border-neo-border bg-neo-surface px-3 py-2">
                          <div className="h-2.5 w-2.5 rounded-full bg-neo-accent animate-pulse-soft" />
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-neo-mute">
                            Try-on · {msg.matches.length} piece{msg.matches.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    )}

                    {msg.tryOnLoading && (
                      <div className="animate-fade-in mb-3 flex items-center gap-3 border-3 border-neo-border bg-neo-yellow-soft p-4 shadow-[3px_3px_0_0_var(--neo-shadow)]">
                        <div className="h-4 w-4 animate-spin border-2 border-neo-accent border-t-transparent rounded-full" />
                        <span className="text-xs font-bold uppercase text-neo-ink">Generating try-on…</span>
                      </div>
                    )}

                    {msg.tryOnError && (
                      <div className="mb-3 flex items-center gap-2 border-2 border-neo-border bg-neo-pink-soft p-3 text-xs font-bold text-neo-ink shadow-[2px_2px_0_0_var(--neo-shadow)] animate-pop-in">
                        <div className="h-3 w-3 bg-neo-accent" />
                        {msg.tryOnError}
                      </div>
                    )}

                    <div className="stagger-grid grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {msg.matches
                        .filter((item) => !msg.selectedIds || msg.selectedIds.has(item.garment_id))
                        .map((item) => (
                          <div key={item.garment_id} className="neo-card-interactive overflow-hidden">
                            {item.image_base64 ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.image_base64} alt={item.garment_type} className="aspect-square w-full bg-neo-bg object-contain" />
                            ) : (
                              <div className="flex aspect-square w-full items-center justify-center bg-neo-bg">
                                <div className="h-8 w-8 border-2 border-neo-mute/20" />
                              </div>
                            )}
                            <div className="border-t-2 border-neo-border p-2">
                              <p className="truncate text-[11px] font-extrabold uppercase text-neo-ink">{item.garment_type}</p>
                              <p className="text-[10px] font-medium text-neo-mute">{item.primary_color}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                    <p className="mt-2 text-[10px] font-extrabold uppercase tracking-widest text-neo-mute">
                      {msg.selectedIds ? msg.selectedIds.size : msg.matches.length} piece{(msg.selectedIds ? msg.selectedIds.size : msg.matches.length) === 1 ? "" : "s"} selected
                    </p>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="animate-fade-in flex items-start gap-3">
                <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center border-2 border-neo-border bg-neo-accent shadow-[2px_2px_0_0_var(--neo-shadow)]">
                  <div className="h-3 w-3 rounded-full bg-white" />
                </div>
                <div className="border-3 border-neo-border bg-neo-yellow-soft px-4 py-3 shadow-[3px_3px_0_0_var(--neo-shadow)]">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex gap-1.5">
                      <span className="h-2 w-2 animate-bounce rounded-sm bg-neo-accent" />
                      <span className="h-2 w-2 animate-bounce rounded-sm bg-neo-yellow" style={{ animationDelay: "0.15s" }} />
                      <span className="h-2 w-2 animate-bounce rounded-sm bg-neo-blue" style={{ animationDelay: "0.3s" }} />
                    </span>
                    <span className="text-xs font-bold uppercase text-neo-ink">Thinking…</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Composer */}
        <div className="composer-bar fixed inset-x-0 bottom-0 z-30 border-t-3 border-neo-border px-4 py-3 sm:px-6">
          <form onSubmit={onSubmit} className="mx-auto flex max-w-3xl gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="DESCRIBE YOUR OUTFIT…"
              className="neo-input h-12 flex-1 px-4 text-sm uppercase placeholder:text-neo-mute/40 placeholder:font-bold"
              disabled={loading}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="neo-btn neo-btn-pink flex h-12 w-12 items-center justify-center disabled:cursor-not-allowed"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
