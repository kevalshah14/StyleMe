"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const neoFileInput =
  "block w-full text-sm text-neo-mute file:mr-4 file:cursor-pointer file:border-[3px] file:border-neo-ink file:bg-neo-yellow file:px-4 file:py-2 file:text-sm file:font-bold file:text-neo-ink file:shadow-[4px_4px_0_0_var(--neo-ink)] file:transition-transform hover:file:translate-x-0.5 hover:file:translate-y-0.5 hover:file:shadow-[2px_2px_0_0_var(--neo-ink)]";

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
    if (a < 1) {
      od[p + 3] = 0;
      continue;
    }
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
  const [userId, setUserId] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
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
      } catch {
        /* ignore */
      }
    })();
  }, [previewUrl, result]);

  useEffect(() => {
    if (user?.user_id) {
      setUserId(user.user_id);
      localStorage.setItem("styleme_user_id", user.user_id);
    }
  }, [user?.user_id]);

  async function onSegment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setIngestResult(null);
    if (!file) {
      setError("Choose an image first.");
      return;
    }
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
      if (myClothesOnly && user?.token) {
        headers.Authorization = `Bearer ${user.token}`;
      }

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
      const data = await res.json();
      setIngestResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIngesting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <header className="neo-card flex flex-wrap items-start justify-between gap-4 rounded-sm p-5">
        <div>
          <p className="inline-block border-[2px] border-neo-ink bg-neo-cyan px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-neo-ink">
            Upload
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-neo-ink md:text-3xl">Add clothes from photos</h1>
          <p className="mt-2 max-w-xl text-sm font-medium leading-relaxed text-neo-mute">
            Pick an outfit photo → segment and label → save pieces to your wardrobe. Then use{" "}
            <Link href="/" className="font-bold text-neo-ink underline decoration-2 underline-offset-2">
              Outfit chat
            </Link>{" "}
            to get suggestions.
          </p>
        </div>
      </header>

      <p className="neo-card-sm rounded-sm p-4 text-xs font-bold leading-relaxed text-neo-mute">
        Selfie enrolled at setup → <span className="text-neo-ink">&ldquo;My clothes only&rdquo;</span> on group shots.
      </p>

      <form onSubmit={onSegment} className="neo-card-sm flex flex-col gap-4 rounded-sm p-5">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-neo-ink">Image</label>
          <input
            type="file"
            accept="image/*"
            className={neoFileInput}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
              setIngestResult(null);
              setError(null);
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-neo-ink">What to find</label>
          <textarea
            rows={2}
            placeholder="clothes — or jacket, pants, shoes"
            className="neo-input rounded-sm px-3 py-2 text-sm placeholder:text-neo-mute/60"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
          />
        </div>

        <div className="flex max-w-xs flex-col gap-2">
          <label className="text-sm font-bold text-neo-ink">Confidence: {conf.toFixed(2)}</label>
          <input
            type="range"
            min={0.7}
            max={0.99}
            step={0.01}
            value={conf}
            onChange={(e) => setConf(Number(e.target.value))}
            className="h-3 w-full cursor-pointer accent-neo-accent"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-neo-ink">
          <input
            type="checkbox"
            checked={myClothesOnly}
            onChange={(e) => setMyClothesOnly(e.target.checked)}
            className="h-4 w-4 rounded-sm border-[3px] border-neo-ink accent-neo-accent"
          />
          My clothes only — <code className="neo-code rounded-sm px-1 text-[11px]">/api/segment/me</code>
        </label>

        <button
          type="submit"
          disabled={loading || !file}
          className="neo-btn neo-btn-pink rounded-sm px-4 py-3 text-sm font-bold disabled:cursor-not-allowed"
        >
          {loading ? "Segmenting with SAM 3 + Gemini..." : "Segment & label"}
        </button>
      </form>

      {error && (
        <p className="border-[3px] border-neo-ink bg-neo-yellow/50 px-3 py-2 text-sm font-bold text-neo-ink shadow-[3px_3px_0_0_var(--neo-ink)]">
          {error}
        </p>
      )}

      {previewUrl && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-neo-ink">
            {result?.items.length ? `Detected ${result.items.length} clothing segments` : "Preview"}
          </h2>
          <canvas
            ref={canvasRef}
            className="max-h-[60vh] w-full border-[3px] border-neo-ink bg-neo-surface object-contain shadow-[6px_6px_0_0_var(--neo-ink)]"
          />
        </div>
      )}

      {result?.matcher && (
        <p className="border-[3px] border-neo-ink bg-neo-cyan/30 px-3 py-2 text-xs font-bold text-neo-ink shadow-[3px_3px_0_0_var(--neo-ink)]">
          Face matcher: matched={String(result.matcher.matched)} · score {result.matcher.score} · faces{" "}
          {result.matcher.faces_detected}
          {result.matcher.reason ? ` · ${result.matcher.reason}` : ""}
          {result.matcher.face_bbox ? (
            <span className="mt-0.5 block font-mono text-[10px] opacity-90">
              bbox [{result.matcher.face_bbox.map((v) => Math.round(v)).join(", ")}]
            </span>
          ) : null}
        </p>
      )}

      {result && result.items.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-neo-ink">{result.items.length} clothing items found</h2>
            <button
              type="button"
              onClick={onSaveToWardrobe}
              disabled={ingesting || !!ingestResult}
              className={
                ingestResult
                  ? "neo-btn neo-btn-lime rounded-sm px-5 py-2 text-sm font-bold"
                  : "neo-btn neo-btn-cyan rounded-sm px-5 py-2 text-sm font-bold disabled:cursor-not-allowed"
              }
            >
              {ingesting
                ? "Embedding & saving…"
                : ingestResult
                  ? `Saved ${ingestResult.items_saved} items!`
                  : "Save to wardrobe"}
            </button>
          </div>

          {ingestResult && (
            <div className="neo-card-sm rounded-sm border-neo-ink bg-neo-lime/40 p-4 text-sm font-bold text-neo-ink">
              <p>{ingestResult.message}</p>
              <ul className="mt-2 space-y-1 text-xs font-medium">
                {ingestResult.items.map((it) => (
                  <li key={it.garment_id}>
                    {it.garment_type} ({it.primary_color}) — {it.description.slice(0, 60)}...
                  </li>
                ))}
              </ul>
              <Link
                href="/wardrobe"
                className="mt-3 inline-block text-xs font-bold text-neo-ink underline decoration-2 underline-offset-2"
              >
                View wardrobe →
              </Link>
            </div>
          )}

          <ul className="flex flex-col gap-3">
            {result.items.map((item, i) => (
              <li
                key={`${i}-${item.bbox.join(",")}`}
                className="neo-card-sm flex flex-col gap-1 rounded-sm px-3 py-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold capitalize text-neo-ink">
                    {item.clothing?.short_label ?? item.category}
                  </span>
                  <span className="text-xs font-bold text-neo-mute">score {item.confidence}</span>
                </div>
                {item.clothing && (
                  <div className="text-xs font-medium text-neo-mute">
                    {item.clothing.garment_type} — {item.clothing.body_region}
                    {item.clothing.notable_details && (
                      <span className="mt-1 block text-neo-ink">{item.clothing.notable_details}</span>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
