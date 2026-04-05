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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

/** HSL (h 0–360, s/l 0–100) → RGB 0–255 */
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

/**
 * Tint by mask luminance. Grayscale mask PNGs have no alpha; using destination-in
 * with drawImage makes every pixel fully opaque and paints the whole canvas (bug).
 */
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

async function drawMasksAndBoxes(
  canvas: HTMLCanvasElement,
  imageSrc: string,
  items: SegmentItem[],
): Promise<void> {
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

export default function SegmentPlayground() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [conf, setConf] = useState(0.6);
  const [annotateGemini, setAnnotateGemini] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SegmentResponse | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
        if (result?.items?.length) {
          await drawMasksAndBoxes(canvas, previewUrl, result.items);
        } else {
          await drawBaseOnly(canvas, previewUrl);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [previewUrl, result]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!file) {
      setError("Choose an image first.");
      return;
    }

    setLoading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("prompts", "");
      body.append("conf", String(conf));
      body.append("annotate", annotateGemini ? "true" : "false");

      const res = await fetch(`${API_BASE}/api/segment`, {
        method: "POST",
        body,
      });

      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(
          typeof detail?.detail === "string" ? detail.detail : `Request failed (${res.status})`,
        );
      }

      const data = (await res.json()) as SegmentResponse;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Segment clothing (SAM 3)
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          SAM 3 runs with the fixed text concept <span className="italic">clothes</span> and segments{" "}
          <strong>all</strong> matching garment instances in the image. Requires local <code className="text-xs">sam3.pt</code>{" "}
          (see <code className="text-xs">docs/SAM3.md</code>).
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="image" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Image
          </label>
          <input
            id="image"
            name="image"
            type="file"
            accept="image/*"
            className="block w-full text-sm text-zinc-600 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800 dark:text-zinc-400 dark:file:bg-zinc-100 dark:file:text-zinc-900"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
              setError(null);
            }}
          />
        </div>

        <div className="flex flex-col gap-1 sm:max-w-xs">
          <label htmlFor="conf" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            SAM 3 score threshold: {conf.toFixed(2)} (results under 0.60 are never returned)
          </label>
          <input
            id="conf"
            type="range"
            min={0.6}
            max={0.99}
            step={0.01}
            value={conf}
            onChange={(e) => setConf(Number(e.target.value))}
            className="w-full accent-zinc-900 dark:accent-zinc-100"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !file}
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading
            ? annotateGemini
              ? "Running SAM 3 + Gemini…"
              : "Running SAM 3…"
            : "Segment"}
        </button>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={annotateGemini}
            onChange={(e) => setAnnotateGemini(e.target.checked)}
            className="rounded border-zinc-400 accent-zinc-900 dark:accent-zinc-100"
          />
          Label each segment with Gemini (needs{" "}
          <code className="text-xs">GEMINI_API_KEY</code> on the API)
        </label>
      </form>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {previewUrl ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {result?.items.length ? "Masks + detector boxes (dashed)" : "Preview"}
          </h2>
          <canvas
            ref={canvasRef}
            className="max-h-[70vh] w-full rounded-lg border border-zinc-200 bg-zinc-100 object-contain dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      ) : null}

      {result ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Detections ({result.items.length})
          </h2>
          <p className="text-xs text-zinc-500">
            Concept: {result.prompts.join(", ")}
            {typeof result.min_confidence === "number"
              ? ` — min score ${result.min_confidence}`
              : null}
          </p>
          {result.segments_dir ? (
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Saved cutouts: <code className="break-all">{result.segments_dir}</code>
              {result.segment_manifest ? (
                <>
                  {" "}
                  · manifest <code className="text-xs">{result.segment_manifest}</code>
                </>
              ) : null}
            </p>
          ) : null}
          {result.gemini_model ? (
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Gemini model: <code className="text-xs">{result.gemini_model}</code>
            </p>
          ) : null}
          {result.gemini_annotation_error ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
              Gemini annotation: {result.gemini_annotation_error}
            </p>
          ) : null}
          <ul className="flex flex-col gap-2">
            {result.items.map((item, i) => (
              <li
                key={`${item.category}-${i}-${item.bbox.join(",")}`}
                className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium capitalize text-zinc-900 dark:text-zinc-100">
                    {item.clothing?.short_label ?? item.category}
                  </span>
                  <span className="text-zinc-600 dark:text-zinc-400">score {item.confidence}</span>
                </div>
                {item.clothing ? (
                  <div className="text-xs text-zinc-600 dark:text-zinc-300">
                    <span className="font-medium text-zinc-800 dark:text-zinc-100">Gemini: </span>
                    {item.clothing.garment_type}
                    <span className="text-zinc-500 dark:text-zinc-400"> — {item.clothing.body_region}</span>
                    {item.clothing.notable_details ? (
                      <span className="mt-0.5 block text-zinc-500 dark:text-zinc-400">
                        {item.clothing.notable_details}
                      </span>
                    ) : null}
                    <span className="mt-0.5 block text-zinc-500 dark:text-zinc-400">
                      SAM concept: {item.category}
                    </span>
                  </div>
                ) : null}
                <code className="text-xs text-zinc-500 dark:text-zinc-400">
                  bbox [x1, y1, x2, y2] = [{item.bbox.map((v) => Math.round(v)).join(", ")}]
                </code>
                {item.segment_file ? (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    file: {item.segment_file}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
