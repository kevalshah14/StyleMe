"use client";

import { AppNav } from "@/components/AppNav";
import { useAuth } from "@/components/auth/AuthProvider";
import { chatStream } from "@/lib/api";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type WardrobeItem = {
  garment_id: string;
  garment_type: string;
  primary_color: string;
  description: string;
  image_base64: string;
};

type WebSource = {
  title: string;
  url: string;
};

type ChatMsg = {
  role: "user" | "assistant";
  text: string;
  matches?: WardrobeItem[];
  webSources?: WebSource[];
  tryOnImage?: string;
  tryOnLoading?: boolean;
  tryOnError?: string;
  selectedIds?: Set<string>;
};

const SUGGESTIONS = [
  "Casual Friday office look",
  "Outfit for a dinner date",
  "What's trending for spring 2026?",
  "Something warm for rainy weather",
  "Summer brunch outfit",
  "What should I buy to complement my wardrobe?",
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

  function buildHistory(): { role: string; content: string }[] {
    return messages.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text,
    }));
  }

  async function sendMessage(text: string) {
    if (!text.trim() || !userId) return;
    const trimmed = text.trim();
    const history = buildHistory();

    setMessages((prev) => [
      ...prev,
      { role: "user", text: trimmed },
      { role: "assistant", text: "" },
    ]);
    setInput("");
    setLoading(true);

    try {
      await chatStream(
        trimmed,
        history,
        (chunk) => {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            copy[copy.length - 1] = { ...last, text: last.text + chunk };
            return copy;
          });
        },
        (meta) => {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            const matches = (meta.matches as unknown as WardrobeItem[]) || [];
            const webSources = (meta.web_sources as unknown as WebSource[]) || [];
            copy[copy.length - 1] = {
              ...last,
              matches: matches.length > 0 ? matches : undefined,
              webSources: webSources.length > 0 ? webSources : undefined,
            };
            return copy;
          });
        },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last.role === "assistant" && !last.text) {
          copy[copy.length - 1] = { ...last, text: `Oops — something went wrong. ${msg.slice(0, 100)}` };
        } else {
          copy.push({ role: "assistant", text: `Oops — something went wrong. ${msg.slice(0, 100)}` });
        }
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  async function triggerTryOn(msgIndex: number, matches: WardrobeItem[], query: string) {
    try {
      const garmentIds = matches.map((m) => m.garment_id);
      const token = localStorage.getItem("styleme_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/try-on/wardrobe`, {
        method: "POST",
        headers,
        body: JSON.stringify({ user_id: userId, garment_ids: garmentIds, query }),
      });
      if (res.ok) {
        const data = await res.json();
        const selectedIds = new Set<string>(data.selected_garment_ids ?? garmentIds);
        setMessages((prev) =>
          prev.map((m, i) =>
            i === msgIndex ? { ...m, tryOnImage: data.generated_image, tryOnLoading: false, selectedIds } : m,
          ),
        );
      } else {
        const detail = (await res.json().catch(() => null)) as { detail?: string } | null;
        setMessages((prev) =>
          prev.map((m, i) =>
            i === msgIndex ? { ...m, tryOnLoading: false, tryOnError: detail?.detail || "Try-on failed" } : m,
          ),
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m, i) =>
          i === msgIndex ? { ...m, tryOnLoading: false, tryOnError: "Could not generate try-on" } : m,
        ),
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
        {/* Hero — empty state */}
        {messages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-10 pb-32 pt-8">
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
                Your{" "}
                <span className="relative inline-block -rotate-2 border-3 border-neo-border bg-neo-yellow px-3 py-1 text-neo-on-color shadow-[3px_3px_0_0_var(--neo-shadow)]">
                  Stylist
                  <div className="absolute -right-2 -top-2 h-3 w-3 rounded-full bg-neo-accent" />
                </span>
              </h1>
              <p className="mx-auto mt-5 max-w-sm text-sm font-medium leading-relaxed text-neo-mute">
                Ask me anything — outfit ideas from your wardrobe, what&apos;s trending, or what to buy next.
              </p>
            </div>

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

        {/* Message thread */}
        {messages.length > 0 && (
          <div className="flex flex-1 flex-col gap-5 pb-28 pt-6">
            {messages.map((msg, i) => {
              if (msg.role === "assistant" && !msg.text && !msg.matches && !msg.webSources) return null;
              return (
              <div
                key={i}
                className={`flex flex-col gap-3 ${msg.role === "user" ? "animate-slide-in-right items-end" : "animate-slide-in-left items-start"}`}
              >
                <div className={`flex max-w-[88%] gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  {/* Avatar */}
                  <div
                    className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center border-2 border-neo-border shadow-[2px_2px_0_0_var(--neo-shadow)] transition-transform hover:scale-105 ${
                      msg.role === "user" ? "rounded-full bg-neo-yellow" : "bg-neo-accent"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <span className="text-sm font-black text-neo-on-color">
                        {user?.display_name?.[0]?.toUpperCase() ?? "U"}
                      </span>
                    ) : (
                      <div className="h-3 w-3 rounded-full bg-white" />
                    )}
                  </div>

                  {/* Bubble */}
                  <div
                    className={`border-3 border-neo-border px-4 py-3 shadow-[3px_3px_0_0_var(--neo-shadow)] ${
                      msg.role === "user" ? "bg-neo-yellow-soft" : "bg-neo-surface"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-neo-ink">
                        {msg.text}
                      </p>
                    ) : (
                      <div className="chat-md text-sm font-medium leading-relaxed text-neo-ink">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.text}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>

                {/* Web sources from Google Search */}
                {msg.webSources && msg.webSources.length > 0 && (
                  <div className="w-full max-w-[88%] pl-12">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-neo-blue animate-pulse-soft" />
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-neo-mute">
                        Sources
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {msg.webSources.map((src, si) => (
                        <a
                          key={si}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="neo-card-interactive flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-neo-ink no-underline hover:bg-neo-cyan-soft transition-colors"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-neo-blue">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                          <span className="truncate max-w-[200px]">
                            {src.title || new URL(src.url).hostname}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Outfit cards + try-on (only when matches exist) */}
                {msg.matches && msg.matches.length > 0 && (
                  <div className="w-full max-w-[88%] pl-12">
                    {/* Try-on result */}
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

                    {/* Try-on loading */}
                    {msg.tryOnLoading && (
                      <div className="animate-fade-in mb-3 flex items-center gap-3 border-3 border-neo-border bg-neo-yellow-soft p-4 shadow-[3px_3px_0_0_var(--neo-shadow)]">
                        <div className="h-4 w-4 animate-spin border-2 border-neo-accent border-t-transparent rounded-full" />
                        <span className="text-xs font-bold uppercase text-neo-ink">Generating try-on…</span>
                      </div>
                    )}

                    {/* Try-on error */}
                    {msg.tryOnError && (
                      <div className="mb-3 flex items-center gap-2 border-2 border-neo-border bg-neo-pink-soft p-3 text-xs font-bold text-neo-ink shadow-[2px_2px_0_0_var(--neo-shadow)] animate-pop-in">
                        <div className="h-3 w-3 bg-neo-accent" />
                        {msg.tryOnError}
                      </div>
                    )}

                    {/* Garment cards grid */}
                    <div className="stagger-grid grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {msg.matches
                        .filter((item) => !msg.selectedIds || msg.selectedIds.has(item.garment_id))
                        .map((item) => (
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
                                <div className="h-8 w-8 border-2 border-neo-mute/20" />
                              </div>
                            )}
                            <div className="border-t-2 border-neo-border p-2">
                              <p className="truncate text-[11px] font-extrabold uppercase text-neo-ink">
                                {item.garment_type}
                              </p>
                              <p className="text-[10px] font-medium text-neo-mute">{item.primary_color}</p>
                            </div>
                          </div>
                        ))}
                    </div>

                    {/* Try-on button — only show if not already tried on or loading */}
                    {!msg.tryOnImage && !msg.tryOnLoading && (
                      <button
                        type="button"
                        onClick={() => {
                          const idx = i;
                          setMessages((prev) =>
                            prev.map((m, mi) => (mi === idx ? { ...m, tryOnLoading: true } : m)),
                          );
                          triggerTryOn(
                            idx,
                            msg.matches!,
                            messages.filter((m) => m.role === "user").pop()?.text ?? "",
                          );
                        }}
                        className="neo-btn neo-btn-pink mt-3 px-4 py-2.5 text-xs font-extrabold uppercase"
                      >
                        Try on this outfit
                      </button>
                    )}

                    <p className="mt-2 text-[10px] font-extrabold uppercase tracking-widest text-neo-mute">
                      {msg.selectedIds ? msg.selectedIds.size : msg.matches.length} piece
                      {(msg.selectedIds ? msg.selectedIds.size : msg.matches.length) === 1 ? "" : "s"} selected
                    </p>
                  </div>
                )}
              </div>
              );
            })}

            {/* Loading indicator — hide once streaming text starts arriving */}
            {loading && !(messages.length > 0 && messages[messages.length - 1].role === "assistant" && messages[messages.length - 1].text) && (
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
                    <span className="text-xs font-bold uppercase text-neo-ink">Styling…</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Composer bar */}
        <div className="composer-bar fixed inset-x-0 bottom-0 z-30 border-t-3 border-neo-border px-4 py-3 sm:px-6">
          <form onSubmit={onSubmit} className="mx-auto flex max-w-3xl gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask your stylist anything…"
              className="neo-input h-12 flex-1 px-4 text-sm placeholder:text-neo-mute/40 placeholder:font-medium"
              disabled={loading}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="neo-btn neo-btn-pink flex h-12 w-12 items-center justify-center disabled:cursor-not-allowed"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
