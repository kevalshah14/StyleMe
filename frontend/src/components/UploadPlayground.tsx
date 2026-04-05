"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

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

type MatcherMeta = {
  matched: boolean;
  score: number;
  face_bbox: number[] | null;
  faces_detected: number;
  reason: string | null;
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
  face_grounded?: boolean;
  matcher?: MatcherMeta;
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

type Step = 1 | 2 | 3;

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { n: 1, label: "Upload" },
    { n: 2, label: "Segment" },
    { n: 3, label: "Save" },
  ];
  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg border-2 text-sm font-bold transition-colors ${
                current >= s.n
                  ? "border-neo-border bg-neo-accent text-white shadow-[2px_2px_0_0_var(--neo-shadow)]"
                  : "border-neo-border/40 bg-neo-surface text-neo-mute"
              }`}
            >
              {current > s.n ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                s.n
              )}
            </div>
            <span className={`text-[10px] font-bold ${current >= s.n ? "text-neo-ink" : "text-neo-mute/60"}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`mb-4 mx-2 h-0.5 w-8 sm:w-12 transition-colors ${current > s.n ? "bg-neo-accent" : "bg-neo-border/30"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function UploadPlayground() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [promptText, setPromptText] = useState("");
  const [conf, setConf] = useState(0.7);
  const [myClothesOnly, setMyClothesOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SegmentResponse | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [dragging, setDragging] = useState(false);

  const currentStep: Step = ingestResult ? 3 : result?.items?.length ? 2 : 1;

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

  useEffect(() => {
    if (user?.user_id) {
      setUserId(user.user_id);
      localStorage.setItem("styleme_user_id", user.user_id);
    }
  }, [user?.user_id]);

  function handleFile(f: File | null) {
    setFile(f);
    setResult(null);
    setIngestResult(null);
    setError(null);
  }

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(true); }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("image/")) handleFile(f);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSegment(e: React.FormEvent) {
    e.preventDefault();
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
      body.append("prompts", promptText.trim() || "clothes");
      body.append("conf", String(conf));
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
      setIngestResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIngesting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <header className="neo-card rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg border-2 border-neo-border bg-neo-cyan px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-neo-on-color shadow-[2px_2px_0_0_var(--neo-shadow)]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-neo-ink md:text-3xl">Add clothes from photos</h1>
            <p className="mt-2 max-w-lg text-sm font-medium leading-relaxed text-neo-mute">
              Upload an outfit photo, detect individual pieces, then save them to your wardrobe.
            </p>
          </div>
        </div>
      </header>

      {/* Step indicator */}
      <StepIndicator current={currentStep} />

      {/* Drop zone / file picker */}
      {!previewUrl && (
        <div
          className={`drop-zone flex cursor-pointer flex-col items-center justify-center gap-4 px-6 py-16 text-center transition-all ${dragging ? "dragging" : ""}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-3 border-neo-border bg-neo-cyan-soft shadow-[4px_4px_0_0_var(--neo-shadow)]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neo-ink">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-neo-ink">
              {dragging ? "Drop image here" : "Drag & drop an outfit photo"}
            </p>
            <p className="mt-1 text-xs text-neo-mute">or click to browse files</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </div>
      )}

      {/* Preview & controls */}
      {previewUrl && (
        <div className="flex flex-col gap-5 animate-fade-in">
          {/* Canvas preview */}
          <div className="relative overflow-hidden rounded-xl border-3 border-neo-border bg-neo-surface shadow-[6px_6px_0_0_var(--neo-shadow)]">
            <canvas
              ref={canvasRef}
              className="max-h-[55vh] w-full object-contain"
            />
            {result?.items?.length ? (
              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-lg border-2 border-neo-border bg-neo-lime px-2.5 py-1 text-xs font-bold text-neo-on-color shadow-[2px_2px_0_0_var(--neo-shadow)]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                {result.items.length} item{result.items.length === 1 ? "" : "s"} detected
              </div>
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

          {/* Segment form */}
          {!result && (
            <form onSubmit={onSegment} className="neo-card-sm flex flex-col gap-4 rounded-xl p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-neo-mute">What to find</label>
                  <textarea
                    rows={2}
                    placeholder="clothes — or jacket, pants, shoes"
                    className="neo-input rounded-lg px-3 py-2.5 text-sm placeholder:text-neo-mute/40"
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-neo-mute">
                      Confidence: <span className="text-neo-ink">{conf.toFixed(2)}</span>
                    </label>
                    <input
                      type="range"
                      min={0.7}
                      max={0.99}
                      step={0.01}
                      value={conf}
                      onChange={(e) => setConf(Number(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-neo-bg accent-neo-accent [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-neo-border [&::-webkit-slider-thumb]:bg-neo-accent [&::-webkit-slider-thumb]:shadow-[2px_2px_0_0_var(--neo-shadow)]"
                    />
                  </div>
                  <label className="flex cursor-pointer items-center gap-2.5 text-xs font-bold text-neo-ink">
                    <input
                      type="checkbox"
                      checked={myClothesOnly}
                      onChange={(e) => setMyClothesOnly(e.target.checked)}
                      className="h-4 w-4 rounded border-2 border-neo-border accent-neo-accent"
                    />
                    My clothes only (face matching)
                  </label>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !file}
                className="neo-btn neo-btn-pink flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                      <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                    Segmenting with SAM 3 + Gemini…
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    Segment &amp; label
                  </>
                )}
              </button>
            </form>
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
                <button
                  type="button"
                  onClick={onSaveToWardrobe}
                  disabled={ingesting || !!ingestResult}
                  className={`neo-btn flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold ${
                    ingestResult ? "neo-btn-lime" : "neo-btn-cyan disabled:cursor-not-allowed"
                  }`}
                >
                  {ingesting ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                        <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                      </svg>
                      Saving…
                    </>
                  ) : ingestResult ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      Saved {ingestResult.items_saved} item{ingestResult.items_saved === 1 ? "" : "s"}!
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
                      </svg>
                      Save to wardrobe
                    </>
                  )}
                </button>
              </div>

              {/* Success message */}
              {ingestResult && (
                <div className="animate-scale-in flex flex-col gap-3 rounded-xl border-2 border-neo-border bg-neo-lime-soft p-5 shadow-[4px_4px_0_0_var(--neo-shadow)]">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-neo-border bg-neo-lime text-neo-on-color shadow-[2px_2px_0_0_var(--neo-shadow)]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <p className="text-sm font-bold text-neo-ink">{ingestResult.message}</p>
                  </div>
                  <ul className="space-y-1 pl-10 text-xs font-medium text-neo-mute">
                    {ingestResult.items.map((it) => (
                      <li key={it.garment_id} className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-neo-accent" />
                        <span className="font-bold capitalize text-neo-ink">{it.garment_type}</span>
                        <span className="text-neo-mute">({it.primary_color})</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-3 pl-10">
                    <Link
                      href="/wardrobe"
                      className="neo-btn neo-btn-yellow flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9h18V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4Z" />
                        <path d="M3 11v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8" />
                      </svg>
                      View wardrobe
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleFile(null)}
                      className="flex items-center gap-2 rounded-lg border-2 border-neo-border bg-neo-surface px-4 py-2 text-xs font-bold text-neo-ink shadow-[3px_3px_0_0_var(--neo-shadow)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_0_var(--neo-shadow)]"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Upload another
                    </button>
                  </div>
                </div>
              )}

              {/* Detected items list */}
              <div className="stagger-grid grid gap-2.5 sm:grid-cols-2">
                {result.items.map((item, i) => (
                  <div
                    key={`${i}-${item.bbox.join(",")}`}
                    className="neo-card-sm flex items-start gap-3 rounded-xl p-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-neo-border bg-neo-bg text-xs font-bold text-neo-ink shadow-[2px_2px_0_0_var(--neo-shadow)]">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-bold capitalize text-neo-ink">
                          {item.clothing?.short_label ?? item.category}
                        </p>
                        <span className="shrink-0 rounded-md bg-neo-bg px-1.5 py-0.5 text-[10px] font-bold text-neo-mute">
                          {(item.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      {item.clothing && (
                        <p className="mt-0.5 text-xs text-neo-mute">
                          {item.clothing.garment_type} · {item.clothing.body_region}
                        </p>
                      )}
                      {item.clothing?.notable_details && (
                        <p className="mt-1 text-xs font-medium text-neo-ink">{item.clothing.notable_details}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="animate-fade-in flex items-start gap-3 rounded-xl border-2 border-neo-border bg-neo-pink-soft p-4 shadow-[3px_3px_0_0_var(--neo-shadow)]">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-neo-border bg-neo-accent">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <p className="text-sm font-bold text-neo-ink">{error}</p>
        </div>
      )}
    </div>
  );
}
