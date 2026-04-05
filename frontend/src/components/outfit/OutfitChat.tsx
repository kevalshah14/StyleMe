"use client";

import { AppNav } from "@/components/AppNav";
import { useAuth } from "@/components/auth/AuthProvider";
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
  "Casual Friday office look",
  "Outfit for a dinner date",
  "Job interview — professional but not stiff",
  "Something warm for rainy weather",
  "Summer brunch outfit",
  "What goes with a navy blazer?",
];

export function OutfitChat() {
  const { user } = useAuth();
  const [userId, setUserId] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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
          {
            role: "assistant",
            text: `Could not get suggestions.${raw ? ` (${raw.slice(0, 120)})` : ""}`,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Could not reach the API at ${API_BASE}. Is the backend running?`,
        },
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
    <div className="flex min-h-full flex-1 flex-col">
      <AppNav />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6">
        {messages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 pb-8 text-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-neo-ink md:text-4xl">
                What do you want to wear?
              </h1>
              <p className="mx-auto mt-3 max-w-md text-sm font-medium leading-relaxed text-neo-mute">
                Describe the occasion, weather, or vibe. We&apos;ll search your wardrobe and show matching pieces.
              </p>
            </div>
            <div className="flex max-w-lg flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => sendMessage(s)}
                  className="neo-tag rounded-sm px-3 py-2 text-left text-xs font-bold text-neo-ink neo-press"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.length > 0 && (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto pb-28">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col gap-3 ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[90%] rounded-sm border-[3px] border-neo-ink px-4 py-3 shadow-[4px_4px_0_0_var(--neo-ink)] ${
                    msg.role === "user"
                      ? "bg-neo-lime/80 text-neo-ink"
                      : "bg-neo-surface text-neo-ink"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed">{msg.text}</p>
                </div>
                {msg.matches && msg.matches.length > 0 && (
                  <div className="grid w-full max-w-[90%] grid-cols-2 gap-2 sm:grid-cols-3">
                    {msg.matches.map((item) => (
                      <div
                        key={item.garment_id}
                        className="neo-card-sm overflow-hidden rounded-sm bg-neo-surface"
                      >
                        {item.image_base64 ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.image_base64}
                            alt={item.garment_type}
                            className="aspect-square w-full bg-neo-bg object-contain"
                          />
                        ) : (
                          <div className="flex aspect-square w-full items-center justify-center bg-neo-bg text-[10px] font-bold text-neo-mute">
                            No image
                          </div>
                        )}
                        <div className="p-2">
                          <p className="truncate text-xs font-bold capitalize text-neo-ink">
                            {item.garment_type}
                          </p>
                          <p className="text-[10px] font-medium text-neo-mute">{item.primary_color}</p>
                          {item.description && (
                            <p className="mt-0.5 line-clamp-2 text-[10px] text-neo-mute">{item.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {msg.totalWardrobe != null && msg.matches && msg.matches.length > 0 && (
                  <p className="text-[10px] font-bold uppercase tracking-wide text-neo-mute">
                    {msg.matches.length} picks from {msg.totalWardrobe} items
                    {msg.searchMethod ? (
                      <span className="ml-2 rounded-sm border border-neo-ink px-1.5 py-0.5">{msg.searchMethod}</span>
                    ) : null}
                  </p>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 rounded-sm border-[3px] border-neo-ink bg-neo-yellow/40 px-4 py-3 font-bold text-neo-ink shadow-[3px_3px_0_0_var(--neo-ink)]">
                <span className="inline-flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-neo-ink" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-neo-ink [animation-delay:0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-neo-ink [animation-delay:0.3s]" />
                </span>
                <span className="text-xs">Searching your wardrobe…</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        <form
          onSubmit={onSubmit}
          className="fixed bottom-0 left-0 right-0 border-t-[3px] border-neo-ink bg-neo-surface px-4 py-4 shadow-[0_-4px_0_0_var(--neo-ink)]"
        >
          <div className="mx-auto flex max-w-2xl gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. I need something for a wedding this weekend…"
              className="neo-input min-h-[48px] flex-1 rounded-sm px-4 py-3 text-sm placeholder:text-neo-mute/60"
              disabled={loading}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="neo-btn neo-btn-pink rounded-sm px-6 py-3 text-sm font-bold disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
