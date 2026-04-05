"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { searchWardrobeMatches } from "@/lib/api";
import type { WardrobeMatch } from "@/lib/types";

const SUGGESTIONS = [
  "black shirt for dinner",
  "smart casual look for office",
  "summer outfit for brunch",
  "dark jacket for night out",
];

interface OutfitSuggestion {
  name: string;
  items: WardrobeMatch[];
}

function byScoreDesc(a: WardrobeMatch, b: WardrobeMatch) {
  const av = typeof a.score === "number" ? a.score : -Infinity;
  const bv = typeof b.score === "number" ? b.score : -Infinity;
  return bv - av;
}

function pickByKeywords(items: WardrobeMatch[], keywords: string[]): WardrobeMatch[] {
  return items.filter((item) => {
    const type = (item.garment_type || "").toLowerCase();
    return keywords.some((k) => type.includes(k));
  });
}

function buildClosestOutfits(matches: WardrobeMatch[]): OutfitSuggestion[] {
  const sorted = [...matches].sort(byScoreDesc);
  const tops = pickByKeywords(sorted, ["shirt", "tee", "t-shirt", "top", "sweater", "hoodie", "blouse"]);
  const bottoms = pickByKeywords(sorted, ["pant", "jean", "trouser", "chino", "short", "skirt"]);
  const outers = pickByKeywords(sorted, ["jacket", "coat", "blazer", "cardigan"]);
  const shoes = pickByKeywords(sorted, ["shoe", "sneaker", "boot", "loafer", "heel", "sandal"]);
  const onePieces = pickByKeywords(sorted, ["dress", "jumpsuit", "romper"]);

  const used = new Set<string>();
  const take = (pool: WardrobeMatch[], index = 0) => {
    for (let i = index; i < pool.length; i += 1) {
      const item = pool[i];
      const id = item.garment_id || item.source_id;
      if (!used.has(id)) {
        used.add(id);
        return item;
      }
    }
    return null;
  };

  const outfits: OutfitSuggestion[] = [];
  for (let i = 0; i < 3; i += 1) {
    const row: WardrobeMatch[] = [];

    if (onePieces.length > i) {
      const one = take(onePieces, i);
      if (one) row.push(one);
    } else {
      const top = take(tops, i);
      const bottom = take(bottoms, i);
      if (top) row.push(top);
      if (bottom) row.push(bottom);
    }

    const outer = take(outers, i);
    const shoe = take(shoes, i);
    if (outer) row.push(outer);
    if (shoe) row.push(shoe);

    if (row.length < 2) {
      for (const fallback of sorted) {
        const id = fallback.garment_id || fallback.source_id;
        if (used.has(id)) continue;
        used.add(id);
        row.push(fallback);
        if (row.length >= 3) break;
      }
    }

    if (row.length > 0) {
      outfits.push({
        name: `Closest Outfit ${i + 1}`,
        items: row,
      });
    }
  }

  return outfits;
}

export default function RecommendPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<WardrobeMatch[]>([]);
  const [outfits, setOutfits] = useState<OutfitSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/onboard");
    }
  }, [isAuthenticated, isLoading, router]);

  const runSearch = async (searchText: string) => {
    const trimmed = searchText.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");
    setSubmittedQuery(trimmed);

    try {
      const result = await searchWardrobeMatches(trimmed, 12);
      setMatches(result.matches);
      setOutfits(buildClosestOutfits(result.matches));
    } catch (err) {
      setMatches([]);
      setOutfits([]);
      setError(err instanceof Error ? err.message : "Failed to search HydraDB");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runSearch(query);
  };

  if (isLoading || !isAuthenticated) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">Style Me</h1>
        <p className="text-text-secondary text-sm mb-6">
          Ask for a piece or describe a look. We search your HydraDB embeddings and return the closest wardrobe matches with images.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-surface rounded-3xl border border-border p-4 md:p-5 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. show me a blue shirt for dinner"
            className="flex-1 px-4 py-3 rounded-2xl border border-border bg-background text-foreground placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/30"
            autoFocus
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="px-6 py-3 bg-accent text-white font-semibold rounded-2xl hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? "Searching..." : "Find Matches"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                setQuery(suggestion);
                void runSearch(suggestion);
              }}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-background border border-border text-text-secondary hover:text-foreground hover:border-accent/40 transition"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </form>

      {error && <div className="mb-6 p-4 bg-error/10 text-error text-sm rounded-2xl">{error}</div>}

      {loading && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="bg-surface rounded-3xl border border-border overflow-hidden">
              <div className="aspect-[4/5] skeleton" />
              <div className="p-4 space-y-2">
                <div className="h-5 skeleton rounded-lg w-2/3" />
                <div className="h-4 skeleton rounded-lg w-full" />
                <div className="h-4 skeleton rounded-lg w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && submittedQuery && (
        <div className="mb-4">
          <h2 className="text-lg font-semibold">
            Closest matches for &ldquo;{submittedQuery}&rdquo;
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            {matches.length > 0
              ? `${matches.length} items returned from HydraDB embeddings`
              : "No close matches found. Try a different description or upload more clothes."}
          </p>
        </div>
      )}

      {!loading && outfits.length > 0 && (
        <div className="grid lg:grid-cols-3 gap-4 mb-8">
          {outfits.map((outfit) => (
            <article
              key={outfit.name}
              className="bg-surface rounded-3xl border border-border overflow-hidden shadow-sm"
            >
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold">{outfit.name}</h3>
                <p className="text-xs text-text-secondary">Built from closest embedding matches</p>
              </div>
              <div className="p-4 space-y-3">
                {outfit.items.map((item, index) => (
                  <div key={`${item.garment_id}-${index}`} className="flex gap-3">
                    <div className="w-16 h-16 rounded-lg bg-border/20 overflow-hidden flex-shrink-0">
                      {item.image_base64 ? (
                        <img
                          src={item.image_base64}
                          alt={item.description || item.garment_type}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-text-secondary text-center">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold capitalize truncate">
                        {item.primary_color} {item.garment_type}
                      </p>
                      {typeof item.score === "number" && (
                        <p className="text-[11px] text-text-secondary">score: {item.score.toFixed(3)}</p>
                      )}
                      <p className="text-xs text-text-secondary line-clamp-2">
                        {item.description || "No description"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && matches.length > 0 && (
        <>
          <h3 className="text-base font-semibold mb-3">All Closest Items</h3>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {matches.map((item, index) => (
              <article
                key={`${item.garment_id}-${index}`}
                className="bg-surface rounded-3xl border border-border overflow-hidden shadow-sm"
              >
                <div className="aspect-[4/5] bg-border/20 overflow-hidden">
                  {item.image_base64 ? (
                    <img
                      src={item.image_base64}
                      alt={item.description || item.garment_type}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm text-text-secondary px-6 text-center">
                      No image stored for this embedding
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="font-semibold capitalize">{item.primary_color} {item.garment_type}</h4>
                    {typeof item.score === "number" && (
                      <span className="px-2 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold">
                        {item.score.toFixed(3)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed min-h-12">
                    {item.description || "No description stored for this item."}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
