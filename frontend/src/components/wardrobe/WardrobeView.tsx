"use client";

import { AppNav } from "@/components/AppNav";
import { useAuth } from "@/components/auth/AuthProvider";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export type WardrobeItem = {
  garment_id: string;
  garment_type: string;
  primary_color: string;
  description: string;
  image_base64: string;
  body_region?: string;
  notable_details?: string;
  style_tags?: string[];
  formality_level?: number;
  confidence?: number;
};

function WardrobeCard({ item, onDelete }: { item: WardrobeItem; onDelete?: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="neo-card-interactive group overflow-hidden">
      <div className="relative">
        {item.image_base64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_base64}
            alt={item.garment_type}
            className="aspect-square w-full bg-neo-bg object-contain transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center bg-neo-bg">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-neo-mute/30">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </div>
        )}
        {item.primary_color && (
          <span className="absolute bottom-1.5 left-1.5 rounded-md border-2 border-neo-border bg-neo-surface px-1.5 py-0.5 text-[10px] font-bold capitalize text-neo-ink shadow-[2px_2px_0_0_var(--neo-shadow)]">
            {item.primary_color}
          </span>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg border-2 border-neo-border bg-neo-surface text-neo-mute opacity-0 shadow-[2px_2px_0_0_var(--neo-shadow)] transition-all hover:bg-neo-accent hover:text-white group-hover:opacity-100"
            aria-label="Delete"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
            </svg>
          </button>
        )}
      </div>

      {confirming ? (
        <div className="flex items-center gap-2 p-3">
          <span className="text-[11px] font-bold text-neo-ink">Delete?</span>
          <button
            type="button"
            onClick={() => { onDelete?.(item.garment_id); setConfirming(false); }}
            className="rounded-md border-2 border-neo-border bg-neo-accent px-2 py-0.5 text-[10px] font-bold text-white shadow-[2px_2px_0_0_var(--neo-shadow)]"
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-md border-2 border-neo-border bg-neo-surface px-2 py-0.5 text-[10px] font-bold text-neo-ink shadow-[2px_2px_0_0_var(--neo-shadow)]"
          >
            No
          </button>
        </div>
      ) : (
        <div className="p-3">
          <p className="truncate text-sm font-bold capitalize text-neo-ink">{item.garment_type}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {String((item as Record<string, unknown>).cluster_label || "") !== "" && (
              <span className="rounded-md bg-neo-bg px-1.5 py-0.5 text-[10px] font-bold text-neo-mute">
                {String((item as Record<string, unknown>).cluster_label)}
              </span>
            )}
          </div>
          {item.description && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-neo-mute">{item.description}</p>
          )}
        </div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="neo-card-sm overflow-hidden">
      <div className="aspect-square w-full skeleton" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-3/4 rounded skeleton" />
        <div className="h-3 w-1/2 rounded skeleton" />
      </div>
    </div>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-16 text-center animate-fade-in">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-3 border-neo-border bg-neo-yellow-soft shadow-[5px_5px_0_0_var(--neo-shadow)]">
        {hasSearch ? (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neo-ink">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        ) : (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neo-ink">
            <path d="M3 9h18V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4Z" />
            <path d="M3 11v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8" />
            <path d="M12 3v18" />
          </svg>
        )}
      </div>
      <div>
        <p className="text-lg font-bold text-neo-ink">
          {hasSearch ? "No matches found" : "Your wardrobe is empty"}
        </p>
        <p className="mt-1 max-w-xs text-sm text-neo-mute">
          {hasSearch
            ? "Try a different search term."
            : "Upload outfit photos and save the pieces to build your wardrobe."}
        </p>
      </div>
      {!hasSearch && (
        <Link
          href="/upload"
          className="neo-btn neo-btn-pink rounded-xl px-6 py-3 text-sm"
        >
          Upload your first outfit
        </Link>
      )}
    </div>
  );
}

export function WardrobeView() {
  const { user } = useAuth();
  const [userId, setUserId] = useState("");
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [wardrobeLoading, setWardrobeLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "clusters">("clusters");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (user?.user_id) {
      setUserId(user.user_id);
      localStorage.setItem("styleme_user_id", user.user_id);
    }
  }, [user?.user_id]);

  const loadWardrobe = useCallback(async () => {
    if (!userId) return;
    setWardrobeLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/wardrobe/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setWardrobe(data.items || []);
      }
    } catch {
      /* silent */
    } finally {
      setWardrobeLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) loadWardrobe();
  }, [userId, loadWardrobe]);

  async function deleteItem(garmentId: string) {
    try {
      const res = await fetch(`${API_BASE}/api/wardrobe/${userId}/${garmentId}`, { method: "DELETE" });
      if (res.ok) {
        setWardrobe((prev) => prev.filter((it) => it.garment_id !== garmentId));
      }
    } catch { /* silent */ }
  }

  const filtered = search.trim()
    ? wardrobe.filter(
        (it) =>
          it.garment_type.toLowerCase().includes(search.toLowerCase()) ||
          it.primary_color.toLowerCase().includes(search.toLowerCase()) ||
          (it.description?.toLowerCase().includes(search.toLowerCase()) ?? false),
      )
    : wardrobe;

  const categories = wardrobe.reduce<Record<string, number>>((acc, it) => {
    const key = it.garment_type || "other";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-neo-bg">
      <AppNav />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        {/* Header */}
        <header className="neo-card rounded-xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-lg border-2 border-neo-border bg-neo-yellow px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-neo-on-color shadow-[2px_2px_0_0_var(--neo-shadow)]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9h18V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4Z" />
                  <path d="M3 11v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8" />
                </svg>
                Wardrobe
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-neo-ink md:text-3xl">Your clothes</h1>
              <p className="mt-1 text-sm font-medium text-neo-mute">
                {wardrobe.length} item{wardrobe.length === 1 ? "" : "s"} in your collection
              </p>
            </div>
            <Link
              href="/upload"
              className="neo-btn neo-btn-cyan flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add clothes
            </Link>
          </div>

          {/* Category chips */}
          {Object.keys(categories).length > 1 && (
            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-neo-border/40 pt-4">
              {Object.entries(categories)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([cat, count]) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSearch(cat)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold capitalize transition-colors ${
                      search.toLowerCase() === cat.toLowerCase()
                        ? "border-2 border-neo-border bg-neo-lime text-neo-on-color shadow-[2px_2px_0_0_var(--neo-shadow)]"
                        : "border-2 border-transparent bg-neo-bg text-neo-mute hover:text-neo-ink"
                    }`}
                  >
                    {cat} <span className="opacity-50">{count}</span>
                  </button>
                ))}
              {search.trim() && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-neo-accent hover:underline"
                >
                  Clear filter
                </button>
              )}
            </div>
          )}
        </header>

        {/* Controls bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-neo-ink sm:text-lg">
            {search.trim()
              ? `${filtered.length} result${filtered.length === 1 ? "" : "s"}`
              : `All items (${filtered.length})`}
          </h2>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neo-mute/50"
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="neo-input h-9 w-40 rounded-lg pl-8 pr-3 text-xs placeholder:text-neo-mute/50 sm:w-48"
              />
            </div>
            <button
              type="button"
              onClick={() => setViewMode(viewMode === "grid" ? "clusters" : "grid")}
              className="flex h-9 items-center gap-1.5 rounded-lg border-2 border-neo-border bg-neo-surface px-3 text-xs font-bold text-neo-ink shadow-[3px_3px_0_0_var(--neo-shadow)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_0_var(--neo-shadow)]"
            >
              {viewMode === "grid" ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                </svg>
              )}
              <span className="hidden sm:inline">{viewMode === "grid" ? "Clusters" : "Grid"}</span>
            </button>
            <button
              type="button"
              onClick={loadWardrobe}
              disabled={wardrobeLoading}
              className="flex h-9 items-center gap-1.5 rounded-lg border-2 border-neo-border bg-neo-yellow px-3 text-xs font-bold text-neo-on-color shadow-[3px_3px_0_0_var(--neo-shadow)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_0_var(--neo-shadow)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={wardrobeLoading ? "animate-spin" : ""}>
                <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              <span className="hidden sm:inline">{wardrobeLoading ? "Loading…" : "Refresh"}</span>
            </button>
          </div>
        </div>

        {/* Loading skeletons */}
        {wardrobeLoading && filtered.length === 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {filtered.length === 0 && !wardrobeLoading && (
          <EmptyState hasSearch={!!search.trim()} />
        )}

        {/* Cluster view */}
        {viewMode === "clusters" &&
          filtered.length > 0 &&
          (() => {
            const clusters: Record<string, WardrobeItem[]> = {};
            filtered.forEach((item) => {
              const c = ((item as Record<string, unknown>).cluster as string) || "other";
              (clusters[c] ||= []).push(item);
            });
            return Object.entries(clusters).map(([cid, items]) => (
              <section key={cid} className="animate-fade-in flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-bold capitalize text-neo-ink">
                    {((items[0] as Record<string, unknown>).cluster_label as string) || cid}
                  </h3>
                  <span className="rounded-md bg-neo-surface px-2 py-0.5 text-[11px] font-bold text-neo-mute">
                    {items.length}
                  </span>
                  <div className="h-px flex-1 bg-neo-border/30" />
                </div>
                <div className="stagger-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {items.map((item) => (
                    <WardrobeCard key={item.garment_id} item={item} onDelete={deleteItem} />
                  ))}
                </div>
              </section>
            ));
          })()}

        {/* Grid view */}
        {viewMode === "grid" && filtered.length > 0 && (
          <div className="stagger-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filtered.map((item) => (
              <WardrobeCard key={item.garment_id} item={item} onDelete={deleteItem} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
