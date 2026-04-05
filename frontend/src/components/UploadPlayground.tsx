"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const DEFAULT_PROMPTS = "shirt,t-shirt,pants,jeans,shorts,jacket,coat,hoodie,sweater,dress,skirt,shoes,sneakers,hat,bag";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Types ────────────────────────────────────────────────────────────────────

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
  items: SegmentItem[];
  prompts: string[];
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

type FileStatus = "pending" | "processing" | "done" | "error";

type QueueItem = {
  id: string;
  file: File;
  previewUrl: string;
  status: FileStatus;
  segmentResult?: SegmentResponse;
  ingestResult?: IngestResult;
  error?: string;
  itemsSaved?: number;
};

// ── Canvas helpers ────────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => { const k = (n + h / 30) % 12; return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); };
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}

function drawMaskTint(destCtx: CanvasRenderingContext2D, maskImg: HTMLImageElement, w: number, h: number, hue: number) {
  const tmp = document.createElement("canvas"); tmp.width = w; tmp.height = h;
  const tctx = tmp.getContext("2d"); if (!tctx) return;
  tctx.drawImage(maskImg, 0, 0, w, h);
  const src = tctx.getImageData(0, 0, w, h);
  const overlay = destCtx.createImageData(w, h);
  const [r, g, b] = hslToRgb(hue, 82, 52);
  for (let p = 0; p < src.data.length; p += 4) {
    const a = ((src.data[p] + src.data[p + 1] + src.data[p + 2]) / 3) * 0.5;
    if (a < 1) { overlay.data[p + 3] = 0; continue; }
    overlay.data[p] = r; overlay.data[p + 1] = g; overlay.data[p + 2] = b; overlay.data[p + 3] = Math.round(a);
  }
  const oc = document.createElement("canvas"); oc.width = w; oc.height = h;
  const octx = oc.getContext("2d"); if (!octx) return;
  octx.putImageData(overlay, 0, 0); destCtx.drawImage(oc, 0, 0);
}

async function drawMasksAndBoxes(canvas: HTMLCanvasElement, imageSrc: string, items: SegmentItem[]) {
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const base = await loadImage(imageSrc);
  canvas.width = base.width; canvas.height = base.height;
  ctx.drawImage(base, 0, 0);
  for (let i = 0; i < items.length; i++) {
    const mask = await loadImage(`data:image/png;base64,${items[i].mask_png}`);
    drawMaskTint(ctx, mask, canvas.width, canvas.height, (i * 53 + 7) % 360);
  }
  ctx.save(); ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
  for (let i = 0; i < items.length; i++) {
    const [x1, y1, x2, y2] = items[i].bbox.map(Math.round);
    ctx.strokeStyle = `hsl(${(i * 53 + 7) % 360} 85% 40%)`;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  }
  ctx.restore();
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status, itemsSaved }: { status: FileStatus; itemsSaved?: number }) {
  if (status === "pending") return (
    <span className="inline-flex items-center gap-1 rounded-full border-2 border-neo-border bg-neo-surface px-2 py-0.5 text-[10px] font-bold text-neo-mute">
      <span className="h-1.5 w-1.5 rounded-full bg-neo-mute" /> Pending
    </span>
  );
  if (status === "processing") return (
    <span className="inline-flex items-center gap-1 rounded-full border-2 border-neo-border bg-neo-cyan-soft px-2 py-0.5 text-[10px] font-bold text-neo-ink">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
      Processing…
    </span>
  );
  if (status === "done") return (
    <span className="inline-flex items-center gap-1 rounded-full border-2 border-neo-border bg-neo-lime-soft px-2 py-0.5 text-[10px] font-bold text-neo-ink">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      {itemsSaved != null ? `${itemsSaved} saved` : "Done"}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border-2 border-neo-border bg-neo-pink-soft px-2 py-0.5 text-[10px] font-bold text-neo-accent">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      Error
    </span>
  );
}

// ── Queue Card ────────────────────────────────────────────────────────────────

function QueueCard({
  item,
  index,
  onRemove,
  isActive,
}: {
  item: QueueItem;
  index: number;
  onRemove: () => void;
  isActive: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !item.previewUrl) return;
    if (item.segmentResult?.items?.length) {
      drawMasksAndBoxes(canvasRef.current, item.previewUrl, item.segmentResult.items).catch(() => {});
    } else {
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;
      loadImage(item.previewUrl).then((img) => {
        if (!canvasRef.current) return;
        canvasRef.current.width = img.width;
        canvasRef.current.height = img.height;
        ctx.drawImage(img, 0, 0);
      }).catch(() => {});
    }
  }, [item.previewUrl, item.segmentResult]);

  return (
    <div className={`neo-card-sm flex gap-3 rounded-xl p-3 transition-all animate-fade-in ${isActive ? "ring-2 ring-neo-accent ring-offset-1" : ""}`}>
      {/* Thumbnail */}
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 border-neo-border bg-neo-bg">
        <canvas ref={canvasRef} className="h-full w-full object-cover" />
        {item.status === "processing" && (
          <div className="absolute inset-0 flex items-center justify-center bg-neo-bg/60">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-neo-accent">
              <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-xs font-bold text-neo-ink">
            {index + 1}. {item.file.name}
          </p>
          {item.status === "pending" && (
            <button
              type="button"
              onClick={onRemove}
              className="shrink-0 flex h-5 w-5 items-center justify-center rounded border border-neo-border bg-neo-surface text-neo-mute hover:bg-neo-accent hover:text-white transition-colors"
              aria-label="Remove"
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          )}
        </div>
        <p className="text-[10px] text-neo-mute">{(item.file.size / 1024).toFixed(0)} KB</p>
        <div className="mt-1.5">
          <StatusBadge status={item.status} itemsSaved={item.itemsSaved} />
        </div>
        {item.status === "done" && item.segmentResult && (
          <p className="mt-1 text-[10px] text-neo-mute">
            {item.segmentResult.items.length} item{item.segmentResult.items.length === 1 ? "" : "s"} detected
          </p>
        )}
        {item.status === "error" && item.error && (
          <p className="mt-1 text-[10px] text-neo-accent">{item.error}</p>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function UploadPlayground() {
  const { user } = useAuth();
<<<<<<< Updated upstream
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
=======
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [promptText, setPromptText] = useState("");
  const [conf, setConf] = useState(0.7);
>>>>>>> Stashed changes
  const [myClothesOnly, setMyClothesOnly] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userId = user?.user_id ?? (typeof window !== "undefined" ? localStorage.getItem("styleme_user_id") ?? "" : "");

  // Add files to queue
  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!arr.length) return;
    setAllDone(false);
    setGlobalError(null);
    const newItems: QueueItem[] = arr.map((f) => ({
      id: `${Date.now()}-${Math.random()}`,
      file: f,
      previewUrl: URL.createObjectURL(f),
      status: "pending",
    }));
    setQueue((prev) => [...prev, ...newItems]);
  }

  function removeItem(id: string) {
    setQueue((prev) => {
      const item = prev.find((q) => q.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((q) => q.id !== id);
    });
  }

  function clearAll() {
    setQueue((prev) => { prev.forEach((q) => URL.revokeObjectURL(q.previewUrl)); return []; });
    setAllDone(false);
    setGlobalError(null);
    setActiveIndex(null);
  }

  // Process all pending items sequentially
  async function processQueue() {
    if (processing) return;
    const pendingIndexes = queue.map((q, i) => (q.status === "pending" ? i : -1)).filter((i) => i >= 0);
    if (!pendingIndexes.length) { setGlobalError("No pending photos to process."); return; }
    if (myClothesOnly && !user?.token) { setGlobalError("Sign in to use face matching."); return; }

    setProcessing(true);
    setGlobalError(null);
    setAllDone(false);

    for (const idx of pendingIndexes) {
      setActiveIndex(idx);

      // Mark processing
      setQueue((prev) => prev.map((q, i) => i === idx ? { ...q, status: "processing" } : q));

      const item = queue[idx];

      try {
        // Step 1: Segment
        const segBody = new FormData();
        segBody.append("file", item.file);
        segBody.append("prompts", promptText.trim() || "clothes");
        segBody.append("conf", String(conf));
        segBody.append("annotate", "true");
        const endpoint = myClothesOnly ? "/api/segment/me" : "/api/segment";
        const headers: HeadersInit = {};
        if (myClothesOnly && user?.token) headers.Authorization = `Bearer ${user.token}`;
        const segRes = await fetch(`${API_BASE}${endpoint}`, { method: "POST", body: segBody, headers });
        if (!segRes.ok) {
          const d = (await segRes.json().catch(() => null)) as { detail?: string } | null;
          throw new Error(typeof d?.detail === "string" ? d.detail : `Segment failed (${segRes.status})`);
        }
        const segResult: SegmentResponse = await segRes.json();

        // Step 2: Auto-save to wardrobe (only if items found and userId exists)
        let ingest: IngestResult | undefined;
        let itemsSaved = 0;
        if (segResult.items.length > 0 && userId) {
          const ingBody = new FormData();
          ingBody.append("file", item.file);
          ingBody.append("user_id", userId);
          ingBody.append("prompts", promptText.trim() || "clothes");
          ingBody.append("conf", String(conf));
          const ingRes = await fetch(`${API_BASE}/api/segment-and-store`, { method: "POST", body: ingBody });
          if (ingRes.ok) {
            ingest = await ingRes.json();
            itemsSaved = ingest?.items_saved ?? 0;
          }
        }

        setQueue((prev) => prev.map((q, i) =>
          i === idx ? { ...q, status: "done", segmentResult: segResult, ingestResult: ingest, itemsSaved } : q
        ));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed";
        setQueue((prev) => prev.map((q, i) => i === idx ? { ...q, status: "error", error: msg } : q));
      }
    }

    setActiveIndex(null);
    setProcessing(false);
    setAllDone(true);
  }

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(true); }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

<<<<<<< Updated upstream
  async function onSegment() {
    setError(null);
    setResult(null);
    setIngestResult(null);
    if (!file) { setError("Choose an image first."); return; }
    if (myClothesOnly && !user?.token) {
      setError("You need to be signed in to use group-photo face matching.");
      return;
    }
    setLoading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("prompts", DEFAULT_PROMPTS);
      body.append("conf", "0.7");
      body.append("annotate", "true");
      const endpoint = myClothesOnly ? "/api/segment/me" : "/api/segment";
      const headers: HeadersInit = {};
      if (myClothesOnly && user?.token) headers.Authorization = `Bearer ${user.token}`;
      const res = await fetch(`${API_BASE}${endpoint}`, { method: "POST", body, headers });
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
      const imageBase64 = await fileToBase64(file);
      const res = await fetch(`${API_BASE}/api/store`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          image_base64: imageBase64,
          segments: result.items,
        }),
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(typeof detail?.detail === "string" ? detail.detail : `Failed (${res.status})`);
      }
      setIngestResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIngesting(false);
    }
  }
=======
  const pendingCount = queue.filter((q) => q.status === "pending").length;
  const doneCount = queue.filter((q) => q.status === "done").length;
  const errorCount = queue.filter((q) => q.status === "error").length;
  const totalSaved = queue.reduce((acc, q) => acc + (q.itemsSaved ?? 0), 0);
>>>>>>> Stashed changes

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <header className="neo-card rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg border-2 border-neo-border bg-neo-cyan px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-neo-on-color shadow-[2px_2px_0_0_var(--neo-shadow)]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Multi-Upload
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-neo-ink md:text-3xl">Add clothes from photos</h1>
            <p className="mt-2 max-w-lg text-sm font-medium leading-relaxed text-neo-mute">
              Upload multiple outfit photos — each is segmented and saved to your wardrobe automatically, one by one.
            </p>
          </div>
          {queue.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-bold text-neo-mute">
              <span className="rounded-lg border-2 border-neo-border bg-neo-surface px-2.5 py-1 shadow-[2px_2px_0_0_var(--neo-shadow)]">
                {queue.length} photo{queue.length === 1 ? "" : "s"}
              </span>
              {doneCount > 0 && (
                <span className="rounded-lg border-2 border-neo-border bg-neo-lime-soft px-2.5 py-1 shadow-[2px_2px_0_0_var(--neo-shadow)] text-neo-ink">
                  ✓ {doneCount} done
                </span>
              )}
              {errorCount > 0 && (
                <span className="rounded-lg border-2 border-neo-border bg-neo-pink-soft px-2.5 py-1 shadow-[2px_2px_0_0_var(--neo-shadow)] text-neo-accent">
                  {errorCount} error{errorCount === 1 ? "" : "s"}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Drop zone */}
      <div
        className={`drop-zone flex cursor-pointer flex-col items-center justify-center gap-4 px-6 py-10 text-center transition-all ${dragging ? "dragging" : ""}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-3 border-neo-border bg-neo-cyan-soft shadow-[4px_4px_0_0_var(--neo-shadow)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neo-ink">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-neo-ink">
            {dragging ? "Drop images here" : "Drag & drop photos"}
          </p>
          <p className="mt-1 text-xs text-neo-mute">or click to browse · select multiple files</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <section className="flex flex-col gap-4 animate-fade-in">
          {/* Controls */}
          <div className="neo-card-sm flex flex-col gap-4 rounded-xl p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-neo-mute">What to find</label>
                <textarea
                  rows={2}
                  placeholder="clothes — or jacket, pants, shoes"
                  className="neo-input rounded-lg px-3 py-2.5 text-sm placeholder:text-neo-mute/40"
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  disabled={processing}
                />
              </div>
<<<<<<< Updated upstream
            ) : null}
            <button
              type="button"
              onClick={() => handleFile(null)}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg border-2 border-neo-border bg-neo-surface text-neo-ink shadow-[2px_2px_0_0_var(--neo-shadow)] transition-all hover:bg-neo-accent hover:text-white"
              aria-label="Remove image"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          {/* Segment controls */}
          {!result && (
            <div className="neo-card-sm flex flex-col gap-4 rounded-xl p-5">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-bold text-neo-ink">
                <input
                  type="checkbox"
                  checked={myClothesOnly}
                  onChange={(e) => setMyClothesOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-2 border-neo-border accent-neo-accent"
                />
                Only segment my clothes (group photo)
              </label>
              <button
                type="button"
                onClick={onSegment}
                disabled={loading || !file}
                className="neo-btn neo-btn-pink flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold disabled:cursor-not-allowed"
=======
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-neo-mute">
                    Confidence: <span className="text-neo-ink">{conf.toFixed(2)}</span>
                  </label>
                  <input
                    type="range" min={0.7} max={0.99} step={0.01} value={conf}
                    onChange={(e) => setConf(Number(e.target.value))}
                    disabled={processing}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-neo-bg accent-neo-accent [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-neo-border [&::-webkit-slider-thumb]:bg-neo-accent [&::-webkit-slider-thumb]:shadow-[2px_2px_0_0_var(--neo-shadow)]"
                  />
                </div>
                <label className="flex cursor-pointer items-center gap-2.5 text-xs font-bold text-neo-ink">
                  <input
                    type="checkbox" checked={myClothesOnly}
                    onChange={(e) => setMyClothesOnly(e.target.checked)}
                    disabled={processing}
                    className="h-4 w-4 rounded border-2 border-neo-border accent-neo-accent"
                  />
                  My clothes only (face matching)
                </label>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={processQueue}
                disabled={processing || pendingCount === 0}
                className="neo-btn neo-btn-pink flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold disabled:cursor-not-allowed"
>>>>>>> Stashed changes
              >
                {processing ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                      <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
<<<<<<< Updated upstream
                    Detecting clothes…
=======
                    Processing {queue.filter(q => q.status === "processing").length > 0 ? `photo ${(activeIndex ?? 0) + 1} of ${queue.length}` : "…"}
>>>>>>> Stashed changes
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
<<<<<<< Updated upstream
                    Detect clothes
                  </>
                )}
              </button>
            </div>
          )}

          {/* Face matcher info */}
          {result?.matcher && (
            <div className="animate-fade-in flex items-start gap-3 rounded-xl border-2 border-neo-border bg-neo-cyan-soft p-4 shadow-[3px_3px_0_0_var(--neo-shadow)]">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-neo-border bg-neo-cyan text-neo-on-color">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className="text-xs font-bold text-neo-ink">
                <p>Face match: {result.matcher.matched ? "Yes" : "No"} · Score {result.matcher.score} · {result.matcher.faces_detected} face{result.matcher.faces_detected === 1 ? "" : "s"}</p>
                {result.matcher.reason && <p className="mt-0.5 font-medium text-neo-mute">{result.matcher.reason}</p>}
              </div>
            </div>
          )}

          {/* Segment results + save */}
          {result && result.items.length > 0 && (
            <section className="animate-fade-in-up flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-bold text-neo-ink">
                  {result.items.length} clothing item{result.items.length === 1 ? "" : "s"} found
                </h2>
=======
                    Process {pendingCount} photo{pendingCount === 1 ? "" : "s"}
                  </>
                )}
              </button>
              {!processing && (
>>>>>>> Stashed changes
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-xl border-2 border-neo-border bg-neo-surface px-4 py-2.5 text-sm font-bold text-neo-ink shadow-[3px_3px_0_0_var(--neo-shadow)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_0_var(--neo-shadow)]"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add more
                </button>
              )}
              {!processing && pendingCount === 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="ml-auto text-xs font-bold text-neo-mute underline underline-offset-2 hover:text-neo-accent transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Photo queue cards */}
          <div className="grid gap-3 sm:grid-cols-2">
            {queue.map((item, i) => (
              <QueueCard
                key={item.id}
                item={item}
                index={i}
                isActive={i === activeIndex}
                onRemove={() => removeItem(item.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* All done summary */}
      {allDone && doneCount > 0 && (
        <div className="animate-scale-in neo-card rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-neo-border bg-neo-lime shadow-[3px_3px_0_0_var(--neo-shadow)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div>
              <p className="text-sm font-bold text-neo-ink">
                All done! {doneCount} photo{doneCount === 1 ? "" : "s"} processed
                {totalSaved > 0 && ` — ${totalSaved} item${totalSaved === 1 ? "" : "s"} saved to wardrobe`}
              </p>
              {errorCount > 0 && (
                <p className="text-xs text-neo-mute mt-0.5">{errorCount} photo{errorCount === 1 ? "" : "s"} had errors</p>
              )}
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <Link
              href="/wardrobe"
              className="neo-btn neo-btn-yellow flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9h18V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4Z" /><path d="M3 11v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8" />
              </svg>
              View wardrobe
            </Link>
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-2 rounded-lg border-2 border-neo-border bg-neo-surface px-4 py-2 text-xs font-bold text-neo-ink shadow-[3px_3px_0_0_var(--neo-shadow)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_0_var(--neo-shadow)]"
            >
              Upload more
            </button>
          </div>
        </div>
      )}

      {/* Global error */}
      {globalError && (
        <div className="animate-fade-in flex items-start gap-3 rounded-xl border-2 border-neo-border bg-neo-pink-soft p-4 shadow-[3px_3px_0_0_var(--neo-shadow)]">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-neo-border bg-neo-accent">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </div>
          <p className="text-sm font-bold text-neo-ink">{globalError}</p>
        </div>
      )}
    </div>
  );
}
