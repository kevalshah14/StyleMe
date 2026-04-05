"use client";

import { AppNav } from "@/components/AppNav";
import { useAuth } from "@/components/auth/AuthProvider";
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

function WardrobeCard({ item }: { item: WardrobeItem }) {
  return (
    <div className="neo-card-sm overflow-hidden rounded-sm bg-neo-surface">
      {item.image_base64 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image_base64}
          alt={item.garment_type}
          className="aspect-square w-full bg-neo-bg object-contain"
        />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-neo-bg text-xs font-bold text-neo-mute">
          No image
        </div>
      )}
      <div className="p-2">
        <p className="truncate text-sm font-bold capitalize text-neo-ink">{item.garment_type}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          {item.primary_color && (
            <span className="text-xs font-medium text-neo-mute">{item.primary_color}</span>
          )}
          {String((item as Record<string, unknown>).cluster_label || "") !== "" && (
            <span className="rounded-sm border-[2px] border-neo-ink px-1.5 py-0.5 text-[10px] font-bold text-neo-mute">
              {String((item as Record<string, unknown>).cluster_label)}
            </span>
          )}
        </div>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-xs font-medium text-neo-mute">{item.description}</p>
        )}
      </div>
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

  const filtered = search.trim()
    ? wardrobe.filter(
        (it) =>
          it.garment_type.toLowerCase().includes(search.toLowerCase()) ||
          it.primary_color.toLowerCase().includes(search.toLowerCase()) ||
          (it.description?.toLowerCase().includes(search.toLowerCase()) ?? false),
      )
    : wardrobe;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppNav />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
        <header className="neo-card rounded-sm p-5">
          <p className="inline-block rounded-sm border-[2px] border-neo-ink bg-neo-yellow px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-neo-ink shadow-[2px_2px_0_0_var(--neo-ink)]">
            Wardrobe
          </p>
          <h1 className="mt-3 text-2xl font-bold text-neo-ink md:text-3xl">Your clothes</h1>
          <p className="mt-1 text-sm font-medium text-neo-mute">
            {wardrobe.length} item{wardrobe.length === 1 ? "" : "s"}
            {user?.display_name ? (
              <>
                {" "}
                · Hi, <span className="text-neo-ink">{user.display_name}</span>
              </>
            ) : null}
          </p>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-neo-ink">
          All items ({filtered.length}
          {search.trim() ? ` of ${wardrobe.length}` : ""})
        </h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="neo-input rounded-sm px-3 py-2 text-xs placeholder:text-neo-mute/60"
          />
          <button
            type="button"
            onClick={() => setViewMode(viewMode === "grid" ? "clusters" : "grid")}
            className="neo-btn neo-btn-ghost rounded-sm px-3 py-1.5 text-xs font-bold"
          >
            {viewMode === "grid" ? "Show clusters" : "Show grid"}
          </button>
          <button
            type="button"
            onClick={loadWardrobe}
            disabled={wardrobeLoading}
            className="neo-btn neo-btn-yellow rounded-sm px-3 py-1.5 text-xs font-bold disabled:cursor-not-allowed"
          >
            {wardrobeLoading ? "Loading…" : "Refresh"}
          </button>
        </div>
        </div>

        {filtered.length === 0 && !wardrobeLoading && (
        <p className="neo-card-sm rounded-sm py-10 text-center text-sm font-bold text-neo-mute">
          {search.trim()
            ? "No matches. Try another search."
            : "No items yet. Use Upload to add photos, then save pieces to your wardrobe."}
        </p>
        )}

        {wardrobeLoading && filtered.length === 0 && (
        <p className="neo-card-sm rounded-sm py-10 text-center text-sm font-bold text-neo-mute">
          Loading wardrobe…
        </p>
        )}

        {viewMode === "clusters" &&
        filtered.length > 0 &&
        (() => {
          const clusters: Record<string, WardrobeItem[]> = {};
          filtered.forEach((item) => {
            const c = ((item as Record<string, unknown>).cluster as string) || "other";
            (clusters[c] ||= []).push(item);
          });
          return Object.entries(clusters).map(([cid, items]) => (
            <section key={cid} className="flex flex-col gap-2">
              <h3 className="border-b-[3px] border-neo-ink pb-2 text-sm font-bold capitalize text-neo-ink">
                {((items[0] as Record<string, unknown>).cluster_label as string) || cid} (
                {items.length})
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {items.map((item) => (
                  <WardrobeCard key={item.garment_id} item={item} />
                ))}
              </div>
            </section>
          ));
        })()}

        {viewMode === "grid" && filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {filtered.map((item) => (
              <WardrobeCard key={item.garment_id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
