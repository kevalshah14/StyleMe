"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { inspectStats, inspectMemories, inspectEmbeddings } from "@/lib/api";

export default function InspectPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [stats, setStats] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [memories, setMemories] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [embeddings, setEmbeddings] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"stats" | "memories" | "embeddings">("stats");
  const [query, setQuery] = useState("all clothing items");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/onboard");
      return;
    }
    void loadStats();
  }, [authLoading, isAuthenticated, router]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await inspectStats();
      setStats(data);
    } catch (e) {
      setStats({ error: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const loadMemories = async () => {
    setLoading(true);
    try {
      const data = await inspectMemories(query);
      setMemories(data);
    } catch (e) {
      setMemories({ error: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const loadEmbeddings = async () => {
    setLoading(true);
    try {
      const data = await inspectEmbeddings(query);
      setEmbeddings(data);
    } catch (e) {
      setEmbeddings({ error: String(e) });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !isAuthenticated) return null;

  const tabs = [
    { id: "stats" as const, label: "Stats" },
    { id: "memories" as const, label: "Memories" },
    { id: "embeddings" as const, label: "Embeddings" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-1">HydraDB Inspector</h1>
      <p className="text-text-secondary text-sm mb-2">
        View your stored wardrobe data in HydraDB.
        Sub-tenant: <code className="bg-border/30 px-1.5 py-0.5 rounded text-xs">user_{user?.user_id?.slice(0, 8)}...</code>
      </p>
      <p className="text-text-secondary text-xs mb-6">
        HydraDB is API-only (no dashboard UI) — this page lets you inspect your data via the SDK.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-border/20 p-1 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              activeTab === tab.id ? "bg-surface shadow-sm text-foreground" : "text-text-secondary hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Query bar for memories/embeddings */}
      {activeTab !== "stats" && (
        <div className="flex gap-2 mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search query..."
            className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            onClick={activeTab === "memories" ? loadMemories : loadEmbeddings}
            disabled={loading}
            className="px-4 py-2 bg-foreground text-white rounded-lg text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 transition"
          >
            {loading ? "Loading..." : "Query"}
          </button>
        </div>
      )}

      {/* Stats tab */}
      {activeTab === "stats" && (
        <div className="space-y-4">
          {loading && <div className="h-48 skeleton rounded-xl" />}
          {stats && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Sub-tenant" value={stats.sub_tenant?.slice(0, 20) + "..."} />
                <StatCard label="Memories" value={stats.memories ?? "?"} />
                <StatCard label="Embeddings" value={stats.embeddings ?? "?"} />
                <StatCard label="Status" value={stats.memory_error || stats.embedding_error ? "Error" : "OK"} />
              </div>

              {stats.memory_sample && (
                <div className="bg-surface rounded-xl border border-border p-4">
                  <h3 className="font-semibold text-sm mb-3">Memory Samples (first 5)</h3>
                  <div className="space-y-2">
                    {stats.memory_sample.map((s: { source_id: string; text: string }, i: number) => (
                      <div key={i} className="text-xs bg-background rounded-lg p-2.5">
                        <span className="font-mono text-accent">{s.source_id?.slice(0, 12)}...</span>
                        <p className="text-text-secondary mt-1">{s.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.embedding_sample && (
                <div className="bg-surface rounded-xl border border-border p-4">
                  <h3 className="font-semibold text-sm mb-3">Embedding Samples (first 5)</h3>
                  <div className="space-y-2">
                    {stats.embedding_sample.map((s: { source_id: string; score: number; metadata: Record<string, unknown> }, i: number) => (
                      <div key={i} className="text-xs bg-background rounded-lg p-2.5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-accent">{s.source_id?.slice(0, 12)}...</span>
                          {s.score != null && (
                            <span className="text-text-secondary">score: {Number(s.score).toFixed(3)}</span>
                          )}
                        </div>
                        <p className="text-text-secondary font-mono">
                          {JSON.stringify(s.metadata, null, 0)?.slice(0, 200)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(stats.memory_error || stats.embedding_error) && (
                <div className="bg-error/10 text-error rounded-xl p-4 text-sm">
                  {stats.memory_error && <p>Memory error: {stats.memory_error}</p>}
                  {stats.embedding_error && <p>Embedding error: {stats.embedding_error}</p>}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Memories tab */}
      {activeTab === "memories" && memories && (
        <div className="space-y-4">
          <div className="flex gap-4 text-sm text-text-secondary">
            <span>Chunks: {memories.chunk_count ?? 0}</span>
            <span>Sources: {memories.source_count ?? 0}</span>
          </div>
          <RawJson data={memories} />
        </div>
      )}

      {/* Embeddings tab */}
      {activeTab === "embeddings" && embeddings && (
        <div className="space-y-4">
          <div className="text-sm text-text-secondary">
            Results: {embeddings.count ?? 0}
          </div>
          <RawJson data={embeddings} />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <p className="text-xs text-text-secondary mb-1">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function RawJson({ data }: { data: unknown }) {
  return (
    <div className="bg-foreground rounded-xl p-4 overflow-x-auto max-h-[60vh] overflow-y-auto">
      <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-words">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
