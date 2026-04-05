"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { getWardrobe, deleteGarment } from "@/lib/api";
import type { WardrobeMatch } from "@/lib/types";

export default function WardrobePage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<WardrobeMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/onboard");
      return;
    }
    void fetchWardrobe();
  }, [authLoading, isAuthenticated, router]);

  const fetchWardrobe = async (query?: string) => {
    if (query) {
      setSearching(true);
    } else {
      setLoading(true);
    }
    try {
      const data = await getWardrobe(query);
      setItems((data.items || []) as WardrobeMatch[]);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setSearching(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchWardrobe(search || undefined);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteGarment(id);
      setItems((prev) => prev.filter((i) => i.garment_id !== id && i.source_id !== id));
    } catch {
      // silent
    }
  };

  if (authLoading || !isAuthenticated) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">
            Hi {user?.display_name}! Your Wardrobe
            {!loading && <span className="text-text-secondary font-normal text-lg ml-2">({items.length} items)</span>}
          </h1>
        </div>
        <Link href="/upload" className="px-5 py-2 bg-accent text-white font-medium rounded-full text-sm hover:bg-accent/90 transition flex-shrink-0">
          + Upload
        </Link>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your wardrobe... e.g., 'warm cozy items' or 'blue formal'"
            className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-surface placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition"
          />
          <button type="submit" disabled={searching} className="px-5 py-2.5 bg-foreground text-white rounded-xl text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 transition">
            {searching ? "..." : "Search"}
          </button>
        </div>
      </form>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-surface rounded-xl border border-border overflow-hidden">
              <div className="aspect-square skeleton" />
              <div className="p-3 space-y-2">
                <div className="h-4 skeleton rounded w-2/3" />
                <div className="h-3 skeleton rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="text-center py-20">
          <svg className="w-16 h-16 text-text-secondary/30 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
          </svg>
          <h2 className="text-lg font-semibold mb-1">Your wardrobe is empty!</h2>
          <p className="text-text-secondary text-sm mb-6">Upload some clothes to get started.</p>
          <Link href="/upload" className="px-6 py-2.5 bg-accent text-white font-medium rounded-full hover:bg-accent/90 transition">
            Upload Clothes
          </Link>
        </div>
      )}

      {/* Grid */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {items.map((item, idx) => {
            const id = item.garment_id || item.source_id || String(idx);
            const type = item.garment_type || "Item";
            const color = item.primary_color || "";
            const formality = Number(item.formality_level || 5);
            const desc = item.description || "";

            return (
              <div
                key={id}
                className="bg-surface rounded-xl border border-border overflow-hidden group hover:shadow-md hover:border-accent/30 transition-all animate-fade-in-up"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="aspect-square bg-border/20">
                  {item.image_base64 ? (
                    <img src={item.image_base64} alt={desc || type} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[11px] text-text-secondary p-2 text-center">
                      No stored image
                    </div>
                  )}
                </div>

                <div className="p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm capitalize">{type}</p>
                      <p className="text-xs text-text-secondary capitalize">{color}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(id)}
                      className="p-1 text-text-secondary/40 hover:text-error transition opacity-0 group-hover:opacity-100"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Formality dots */}
                  <div className="flex gap-0.5 mt-2">
                    {[...Array(10)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full ${i < formality ? "bg-accent" : "bg-border"}`}
                      />
                    ))}
                  </div>

                  {desc && (
                    <p className="text-xs text-text-secondary mt-2 line-clamp-2">{desc}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
