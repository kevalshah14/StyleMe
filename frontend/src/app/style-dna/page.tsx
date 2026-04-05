"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { getStyleDNA } from "@/lib/api";
import type { StyleDNA } from "@/lib/types";

export default function StyleDNAPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [dna, setDna] = useState<StyleDNA | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/onboard");
      return;
    }
    void getStyleDNA()
      .then(setDna)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated) return null;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div className="h-8 skeleton rounded-lg w-64" />
        <div className="grid md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 skeleton rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!dna || dna.total_items === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-bold mb-2">No Style DNA yet</h1>
        <p className="text-text-secondary mb-6">Upload some clothes to see your wardrobe analytics.</p>
        <button onClick={() => router.push("/upload")} className="px-6 py-2.5 bg-accent text-white rounded-full font-medium hover:bg-accent/90 transition">
          Upload Clothes
        </button>
      </div>
    );
  }

  const maxCategory = Math.max(...Object.values(dna.category_breakdown), 1);
  const maxFormality = Math.max(...Object.values(dna.formality_distribution), 1);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-1">{user?.display_name}&apos;s Style DNA</h1>
      <p className="text-text-secondary text-sm mb-8">{dna.total_items} items analyzed</p>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Style archetypes */}
        {dna.style_archetypes.length > 0 && (
          <div className="bg-surface rounded-2xl border border-border p-6">
            <h2 className="font-semibold mb-4">Style Archetypes</h2>
            <div className="flex flex-wrap gap-2">
              {dna.style_archetypes.map((a) => (
                <span key={a} className="px-4 py-2 bg-accent/10 text-accent rounded-full text-sm font-medium">
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Color palette */}
        <div className="bg-surface rounded-2xl border border-border p-6">
          <h2 className="font-semibold mb-4">Color Palette</h2>
          <div className="space-y-2.5">
            {dna.dominant_colors.map((c) => (
              <div key={c.color} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded border border-border flex-shrink-0" style={{ backgroundColor: c.hex }} />
                <span className="text-sm w-16 flex-shrink-0">{c.color}</span>
                <div className="flex-1 h-3 bg-border/30 rounded-full overflow-hidden">
                  <div className="h-full bg-accent/60 rounded-full animate-fill" style={{ width: `${c.percentage}%` }} />
                </div>
                <span className="text-xs text-text-secondary w-8 text-right">{c.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Season coverage */}
        <div className="bg-surface rounded-2xl border border-border p-6">
          <h2 className="font-semibold mb-4">Season Readiness</h2>
          <div className="space-y-3">
            {(["spring", "summer", "fall", "winter"] as const).map((s) => {
              const pct = Math.round((dna.season_coverage[s] || 0) * 100);
              return (
                <div key={s} className="flex items-center gap-3">
                  <span className="text-sm w-16 capitalize flex-shrink-0">{s}</span>
                  <div className="flex-1 h-3 bg-border/30 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full animate-fill"
                      style={{ width: `${pct}%`, backgroundColor: pct > 60 ? "var(--success)" : pct > 30 ? "var(--warning)" : "var(--error)" }}
                    />
                  </div>
                  <span className="text-xs text-text-secondary w-8 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Formality distribution */}
        <div className="bg-surface rounded-2xl border border-border p-6">
          <h2 className="font-semibold mb-4">Formality Distribution</h2>
          <div className="space-y-2.5">
            {["1-2", "3-4", "5-6", "7-8", "9-10"].map((range) => {
              const count = dna.formality_distribution[range] || 0;
              return (
                <div key={range} className="flex items-center gap-3">
                  <span className="text-sm w-10 text-text-secondary flex-shrink-0">{range}</span>
                  <div className="flex-1 h-4 bg-border/30 rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full animate-fill" style={{ width: `${(count / maxFormality) * 100}%` }} />
                  </div>
                  <span className="text-xs text-text-secondary w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-text-secondary mt-3">
            Range: {dna.formality_range.min}–{dna.formality_range.max} (avg {dna.formality_range.average})
          </p>
        </div>

        {/* Category breakdown */}
        <div className="bg-surface rounded-2xl border border-border p-6">
          <h2 className="font-semibold mb-4">Category Breakdown</h2>
          <div className="space-y-2.5">
            {Object.entries(dna.category_breakdown).map(([cat, count]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-sm w-20 capitalize flex-shrink-0">{cat}</span>
                <div className="flex-1 h-4 bg-border/30 rounded-full overflow-hidden">
                  <div className="h-full bg-foreground/60 rounded-full animate-fill" style={{ width: `${(count / maxCategory) * 100}%` }} />
                </div>
                <span className="text-xs text-text-secondary w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Wardrobe gaps */}
        <div className="bg-surface rounded-2xl border border-border p-6">
          <h2 className="font-semibold mb-4">Wardrobe Gaps</h2>
          <div className="space-y-3">
            {dna.wardrobe_gaps.map((gap, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full bg-warning/20 text-warning flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">{gap}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
