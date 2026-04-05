"use client";

import { useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type ClothingDetail = {
  garment_type: string;
  body_region: string;
  short_label: string;
  notable_details?: string;
};

type SegmentItem = {
  category: string;
  bbox: number[];
  confidence: number;
  mask_png: string;
  segment_file?: string;
  clothing?: ClothingDetail;
};

type SegmentResponse = {
  width: number;
  height: number;
  detector: string;
  output?: string;
  min_confidence?: number;
  segments_dir?: string | null;
  segment_manifest?: string | null;
  gemini_model?: string | null;
  gemini_annotation_error?: string | null;
  prompts: string[];
  items: SegmentItem[];
};

type IngestResult = {
  message: string;
  segments_found: number;
  items_saved: number;
  items: {
    garment_id: string;
    garment_type: string;
    primary_color: string;
    description: string;
    confidence: number;
    body_region: string;
    has_image: boolean;
  }[];
};

type WardrobeItem = {
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

type ChatResponse = {
  reply: string;
  matches: WardrobeItem[];
  total_wardrobe: number;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}

function drawMaskTintFromLuminance(
  destCtx: CanvasRenderingContext2D,
  maskImg: HTMLImageElement,
  width: number,
  height: number,
  hue: number,
  maxAlpha: number,
): void {
  const tmp = document.createElement("canvas");
  tmp.width = width;
  tmp.height = height;
  const tctx = tmp.getContext("2d");
  if (!tctx) return;
  tctx.drawImage(maskImg, 0, 0, width, height);
  const src = tctx.getImageData(0, 0, width, height);
  const overlay = destCtx.createImageData(width, height);
  const sd = src.data;
  const od = overlay.data;
  const [r, g, b] = hslToRgb(hue, 82, 52);
  const aMul = maxAlpha * 255;
  for (let p = 0; p < sd.length; p += 4) {
    const lum = (sd[p] + sd[p + 1] + sd[p + 2]) / 3;
    const a = (lum / 255) * aMul;
    if (a < 1) { od[p + 3] = 0; continue; }
    od[p] = r;
    od[p + 1] = g;
    od[p + 2] = b;
    od[p + 3] = Math.round(a);
  }
  const oc = document.createElement("canvas");
  oc.width = width;
  oc.height = height;
  const octx = oc.getContext("2d");
  if (!octx) return;
  octx.putImageData(overlay, 0, 0);
  destCtx.drawImage(oc, 0, 0);
}

function drawBboxOutlines(ctx: CanvasRenderingContext2D, items: SegmentItem[]): void {
  ctx.save();
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  for (let i = 0; i < items.length; i++) {
    const [x1, y1, x2, y2] = items[i].bbox.map(Math.round);
    const hue = (i * 53 + 7) % 360;
    ctx.strokeStyle = `hsl(${hue} 85% 40%)`;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  }
  ctx.restore();
}

async function drawMasksAndBoxes(canvas: HTMLCanvasElement, imageSrc: string, items: SegmentItem[]): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const base = await loadImage(imageSrc);
  canvas.width = base.width;
  canvas.height = base.height;
  ctx.drawImage(base, 0, 0);
  for (let i = 0; i < items.length; i++) {
    const maskSrc = `data:image/png;base64,${items[i].mask_png}`;
    const mask = await loadImage(maskSrc);
    const hue = (i * 53 + 7) % 360;
    drawMaskTintFromLuminance(ctx, mask, canvas.width, canvas.height, hue, 0.5);
  }
  drawBboxOutlines(ctx, items);
}

async function drawBaseOnly(canvas: HTMLCanvasElement, imageSrc: string): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const base = await loadImage(imageSrc);
  canvas.width = base.width;
  canvas.height = base.height;
  ctx.drawImage(base, 0, 0);
}

// ─── Main Component ────────────────────────────────────────────────

export default function SegmentPlayground() {
  // Segment state
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [promptText, setPromptText] = useState("");
  const [conf, setConf] = useState(0.7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SegmentResponse | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Ingest state
  const [userId, setUserId] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("styleme_user_id") || "";
    return "";
  });
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);

  // Wardrobe state
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [wardrobeLoading, setWardrobeLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "clusters">("clusters");

  // Chat state
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatResponse, setChatResponse] = useState<ChatResponse | null>(null);

  // Active tab
  const [tab, setTab] = useState<"segment" | "wardrobe" | "chat">("segment");

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !previewUrl) return;
    (async () => {
      try {
        if (result?.items?.length) await drawMasksAndBoxes(canvas, previewUrl, result.items);
        else await drawBaseOnly(canvas, previewUrl);
      } catch { /* ignore */ }
    })();
  }, [previewUrl, result]);

  // Auto-generate user ID on first visit
  useEffect(() => {
    if (!userId) {
      const id = crypto.randomUUID();
      setUserId(id);
      localStorage.setItem("styleme_user_id", id);
    }
  }, [userId]);

  // Load wardrobe when tab switches
  useEffect(() => {
    if (tab === "wardrobe" && userId) loadWardrobe();
  }, [tab, userId]);

  async function onSegment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setIngestResult(null);
    if (!file) { setError("Choose an image first."); return; }

    setLoading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("prompts", promptText.trim() || "clothes");
      body.append("conf", String(conf));
      body.append("annotate", "true");

      const res = await fetch(`${API_BASE}/api/segment`, { method: "POST", body });
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(typeof detail?.detail === "string" ? detail.detail : `Request failed (${res.status})`);
      }
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function onSaveToWardrobe() {
    if (!file || !result?.items?.length) return;
    setIngesting(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("user_id", userId);
      body.append("prompts", promptText.trim() || "clothes");
      body.append("conf", String(conf));

      const res = await fetch(`${API_BASE}/api/segment-and-store`, { method: "POST", body });
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(typeof detail?.detail === "string" ? detail.detail : `Failed (${res.status})`);
      }
      const data = await res.json();
      setIngestResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIngesting(false);
    }
  }

  async function loadWardrobe() {
    if (!userId) return;
    setWardrobeLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/wardrobe/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setWardrobe(data.items || []);
      }
    } catch { /* silent */ }
    finally { setWardrobeLoading(false); }
  }

  async function onChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || !userId) return;
    setChatLoading(true);
    setChatResponse(null);
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, message: chatInput.trim() }),
      });
      if (res.ok) setChatResponse(await res.json());
    } catch { /* silent */ }
    finally { setChatLoading(false); }
  }

  const tabs = [
    { id: "segment" as const, label: "Segment & Upload" },
    { id: "wardrobe" as const, label: `Wardrobe${wardrobe.length ? ` (${wardrobe.length})` : ""}` },
    { id: "chat" as const, label: "Ask Wardrobe" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          StyleMe
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Upload a photo → SAM 3 segments clothing → Gemini labels → saved to HydraDB → chat to find outfits
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          User: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{userId.slice(0, 12)}...</code>
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              tab === t.id
                ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Segment Tab ───────────────────────────────────── */}
      {tab === "segment" && (
        <>
          <form onSubmit={onSegment} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Image</label>
              <input
                type="file"
                accept="image/*"
                className="block w-full text-sm text-zinc-600 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800 dark:text-zinc-400 dark:file:bg-zinc-100 dark:file:text-zinc-900"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setIngestResult(null); setError(null); }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">What to find</label>
              <textarea
                rows={2}
                placeholder="clothes — or jacket, pants, shoes"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1 sm:max-w-xs">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Confidence: {conf.toFixed(2)}
              </label>
              <input type="range" min={0.7} max={0.99} step={0.01} value={conf} onChange={(e) => setConf(Number(e.target.value))} className="accent-zinc-900 dark:accent-zinc-100" />
            </div>

            <button
              type="submit"
              disabled={loading || !file}
              className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {loading ? "Segmenting with SAM 3 + Gemini..." : "Segment & Label"}
            </button>
          </form>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</p>
          )}

          {previewUrl && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {result?.items.length ? `Detected ${result.items.length} clothing segments` : "Preview"}
              </h2>
              <canvas ref={canvasRef} className="max-h-[60vh] w-full rounded-lg border border-zinc-200 object-contain dark:border-zinc-700" />
            </div>
          )}

          {/* Segment results + Save button */}
          {result && result.items.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">{result.items.length} clothing items found</h2>
                <button
                  onClick={onSaveToWardrobe}
                  disabled={ingesting || !!ingestResult}
                  className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                    ingestResult
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  }`}
                >
                  {ingesting
                    ? "Embedding & saving to HydraDB..."
                    : ingestResult
                    ? `Saved ${ingestResult.items_saved} items!`
                    : "Save to Wardrobe (HydraDB)"}
                </button>
              </div>

              {ingestResult && (
                <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 p-3 text-sm">
                  <p className="font-medium text-green-800 dark:text-green-200">{ingestResult.message}</p>
                  <ul className="mt-2 space-y-1">
                    {ingestResult.items.map((it) => (
                      <li key={it.garment_id} className="text-xs text-green-700 dark:text-green-300">
                        {it.garment_type} ({it.primary_color}) — {it.description.slice(0, 60)}...
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <ul className="flex flex-col gap-2">
                {result.items.map((item, i) => (
                  <li key={`${i}-${item.bbox.join(",")}`} className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize">{item.clothing?.short_label ?? item.category}</span>
                      <span className="text-zinc-500">score {item.confidence}</span>
                    </div>
                    {item.clothing && (
                      <div className="text-xs text-zinc-600 dark:text-zinc-300">
                        {item.clothing.garment_type} — {item.clothing.body_region}
                        {item.clothing.notable_details && <span className="block text-zinc-400">{item.clothing.notable_details}</span>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* ── Wardrobe Tab ──────────────────────────────────── */}
      {tab === "wardrobe" && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold">Your Wardrobe ({wardrobe.length} items)</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode(viewMode === "grid" ? "clusters" : "grid")}
                className="text-xs px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {viewMode === "grid" ? "Show Clusters" : "Show Grid"}
              </button>
              <button onClick={loadWardrobe} disabled={wardrobeLoading} className="text-sm text-blue-600 hover:underline disabled:opacity-50">
                {wardrobeLoading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>

          {wardrobe.length === 0 && !wardrobeLoading && (
            <p className="text-sm text-zinc-500 py-8 text-center">
              No items yet. Upload a photo in the Segment tab and save to wardrobe.
            </p>
          )}

          {viewMode === "clusters" && wardrobe.length > 0 && (() => {
            const clusters: Record<string, WardrobeItem[]> = {};
            wardrobe.forEach((item) => {
              const c = (item as Record<string, unknown>).cluster as string || "other";
              (clusters[c] ||= []).push(item);
            });
            return Object.entries(clusters).map(([cid, items]) => (
              <div key={cid} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold capitalize text-zinc-700 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-700 pb-1">
                  {(items[0] as Record<string, unknown>).cluster_label as string || cid} ({items.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {items.map((item) => <WardrobeCard key={item.garment_id} item={item} />)}
                </div>
              </div>
            ));
          })()}

          {viewMode === "grid" && wardrobe.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {wardrobe.map((item) => <WardrobeCard key={item.garment_id} item={item} />)}
            </div>
          )}
        </section>
      )}

      {/* ── Chat Tab ──────────────────────────────────────── */}
      {tab === "chat" && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Ask Your Wardrobe</h2>
          <p className="text-sm text-zinc-500">
            Describe what you need and see matching items from your wardrobe with images.
          </p>

          <form onSubmit={onChat} className="flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="e.g. blue shirt for dinner, warm jacket, formal pants..."
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim()}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {chatLoading ? "Searching..." : "Search"}
            </button>
          </form>

          {chatResponse && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{chatResponse.reply}</p>
              <p className="text-xs text-zinc-400">
                {chatResponse.matches.length} matches from {chatResponse.total_wardrobe} total items
                {String((chatResponse as Record<string, unknown>).search_method || "") !== "" && (
                  <span className="ml-2 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-[10px]">
                    {String((chatResponse as Record<string, unknown>).search_method)}
                  </span>
                )}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {chatResponse.matches.map((item) => (
                  <div key={item.garment_id} className="rounded-xl border border-blue-200 dark:border-blue-800 overflow-hidden bg-white dark:bg-zinc-900 relative">
                    {item.image_base64 ? (
                      <img src={item.image_base64} alt={item.garment_type} className="w-full aspect-square object-contain bg-zinc-100 dark:bg-zinc-800" />
                    ) : (
                      <div className="w-full aspect-square bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs">No image</div>
                    )}
                    {(item as Record<string, unknown>).score != null && (
                      <span className="absolute top-1 right-1 px-1.5 py-0.5 bg-blue-600 text-white text-[10px] rounded-full font-medium">
                        {((item as Record<string, unknown>).score as number).toFixed(2)}
                      </span>
                    )}
                    <div className="p-2">
                      <p className="font-medium text-sm capitalize truncate">{item.garment_type}</p>
                      <p className="text-xs text-zinc-500">{item.primary_color}</p>
                      {String((item as Record<string, unknown>).cluster_label || "") !== "" && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500 mt-0.5 inline-block">
                          {String((item as Record<string, unknown>).cluster_label)}
                        </span>
                      )}
                      {item.description && <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{item.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!chatResponse && !chatLoading && (
            <div className="flex flex-wrap gap-2 mt-2">
              {["blue shirt", "formal outfit", "warm jacket", "casual pants", "summer clothes"].map((q) => (
                <button
                  key={q}
                  onClick={() => { setChatInput(q); }}
                  className="px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}


function WardrobeCard({ item }: { item: WardrobeItem }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-900">
      {item.image_base64 ? (
        <img src={item.image_base64} alt={item.garment_type} className="w-full aspect-square object-contain bg-zinc-100 dark:bg-zinc-800" />
      ) : (
        <div className="w-full aspect-square bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs">No image</div>
      )}
      <div className="p-2">
        <p className="font-medium text-sm capitalize truncate">{item.garment_type}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {item.primary_color && <span className="text-xs text-zinc-500">{item.primary_color}</span>}
          {String((item as Record<string, unknown>).cluster_label || "") !== "" && (
            <span className="text-[10px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-400">
              {String((item as Record<string, unknown>).cluster_label)}
            </span>
          )}
        </div>
        {item.description && <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{item.description}</p>}
      </div>
    </div>
  );
}
