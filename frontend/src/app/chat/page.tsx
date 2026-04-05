"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { chat } from "@/lib/api";
import type { WardrobeMatch } from "@/lib/types";

interface Message {
  role: "user" | "assistant";
  content: string;
  itemsUsed?: number;
  matches?: WardrobeMatch[];
}

const QUICK_PROMPTS = [
  "show me cream shirt options",
  "black outfit for dinner",
  "summer casual top",
  "smart casual shirt for office",
];

export default function ChatPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/onboard");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (raw: string) => {
    const text = raw.trim();
    if (!text || loading) return;

    const userMessage: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const history = [...messages, userMessage].map((m) => ({ role: m.role, content: m.content }));
      const result = await chat(text, history);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.reply,
          itemsUsed: result.wardrobe_items_used,
          matches: result.matches,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err instanceof Error ? err.message : "Chat failed.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  if (isLoading || !isAuthenticated) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Chat</h1>
      <p className="text-sm text-text-secondary mb-5">
        Ask naturally. Chat fetches closest embedding matches and shows the exact item images from your wardrobe.
      </p>

      {messages.length === 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => void sendMessage(prompt)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-surface border border-border hover:border-accent/50 hover:text-foreground transition"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4 mb-6">
        {messages.map((msg, idx) => (
          <div key={idx} className={`rounded-2xl p-4 ${msg.role === "user" ? "bg-accent text-white" : "bg-surface border border-border"}`}>
            <p className={`text-sm whitespace-pre-wrap ${msg.role === "user" ? "text-white" : "text-foreground"}`}>{msg.content}</p>
            {msg.role === "assistant" && typeof msg.itemsUsed === "number" && (
              <p className="mt-2 text-xs text-text-secondary">Matches used: {msg.itemsUsed}</p>
            )}

            {msg.matches && msg.matches.length > 0 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                {msg.matches.slice(0, 8).map((item, i) => (
                  <div key={`${item.garment_id}-${i}`} className="bg-background border border-border rounded-xl overflow-hidden">
                    <div className="aspect-[4/5] bg-border/20">
                      {item.image_base64 ? (
                        <img src={item.image_base64} alt={item.description || item.garment_type} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[11px] text-text-secondary p-2 text-center">
                          No stored image
                        </div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-semibold capitalize">{item.primary_color} {item.garment_type}</p>
                      {typeof item.score === "number" && (
                        <p className="text-[11px] text-text-secondary">score: {item.score.toFixed(3)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="bg-surface border border-border rounded-2xl p-4">
            <p className="text-sm text-text-secondary">Searching embeddings...</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your wardrobe..."
          className="flex-1 px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="px-5 py-3 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
