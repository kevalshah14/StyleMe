"use client";

import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type OutfitItem = {
  index: number;
  category: string;
  caption: string;
  bbox: number[];
  confidence: number;
  clothing?: {
    garment_type: string;
    body_region: string;
    short_label: string;
    notable_details?: string;
  };
};

type TryOnResponse = {
  segments_detected?: number;
  segments_sent_to_model?: number;
  segments_omitted?: number;
  outfit_summary: {
    width: number;
    height: number;
    prompts: string[];
    min_confidence?: number;
    segments_dir?: string | null;
    segment_manifest?: string | null;
    gemini_model?: string | null;
    gemini_annotation_error?: string | null;
    items: OutfitItem[];
  };
  garments_applied: number;
  generated_image_mime: string | null;
  generated_image_png: string | null;
  gemini_image_model: string | null;
  gemini_image_error: string | null;
  image_model_text: string | null;
};

export default function TryOnPlayground() {
  const [userFile, setUserFile] = useState<File | null>(null);
  const [outfitFile, setOutfitFile] = useState<File | null>(null);
  const [conf, setConf] = useState(0.6);
  const [annotate, setAnnotate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TryOnResponse | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!userFile || !outfitFile) {
      setError("Choose both a user photo and an outfit photo.");
      return;
    }

    setLoading(true);
    try {
      const body = new FormData();
      body.append("user", userFile);
      body.append("outfit", outfitFile);
      body.append("prompts", "");
      body.append("conf", String(conf));
      body.append("annotate", annotate ? "true" : "false");

      const res = await fetch(`${API_BASE}/api/try-on`, {
        method: "POST",
        body,
      });

      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(
          typeof detail?.detail === "string" ? detail.detail : `Request failed (${res.status})`,
        );
      }

      const data = (await res.json()) as TryOnResponse;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const resultSrc =
    result?.generated_image_png && result.generated_image_mime
      ? `data:${result.generated_image_mime};base64,${result.generated_image_png}`
      : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <header>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Virtual try-on (SAM 3 + Nano Banana 2)
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Upload a <strong>user</strong> photo and an <strong>outfit</strong> photo. The outfit is always segmented with
          the text concept <span className="italic">clothes</span> (all garment instances). Each segment is sent to the image
          model (up to 14 by default), ordered head-to-toe. Requires <code className="text-xs">GEMINI_API_KEY</code> and local{" "}
          <code className="text-xs">sam3.pt</code>.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="tryon-user" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              User photo
            </label>
            <input
              id="tryon-user"
              name="user"
              type="file"
              accept="image/*"
              className="block w-full text-sm text-zinc-600 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800 dark:text-zinc-400 dark:file:bg-zinc-100 dark:file:text-zinc-900"
              onChange={(e) => setUserFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="tryon-outfit" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Outfit photo
            </label>
            <input
              id="tryon-outfit"
              name="outfit"
              type="file"
              accept="image/*"
              className="block w-full text-sm text-zinc-600 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800 dark:text-zinc-400 dark:file:bg-zinc-100 dark:file:text-zinc-900"
              onChange={(e) => setOutfitFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 sm:max-w-xs">
          <label htmlFor="tryon-conf" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            SAM 3 threshold: {conf.toFixed(2)}
          </label>
          <input
            id="tryon-conf"
            type="range"
            min={0.6}
            max={0.99}
            step={0.01}
            value={conf}
            onChange={(e) => setConf(Number(e.target.value))}
            className="w-full accent-zinc-900 dark:accent-zinc-100"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={annotate}
            onChange={(e) => setAnnotate(e.target.checked)}
            className="rounded border-zinc-400 accent-zinc-900 dark:accent-zinc-100"
          />
          Label garments (Flash-Lite) to improve the try-on prompt
        </label>

        <button
          type="submit"
          disabled={loading || !userFile || !outfitFile}
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? "Segmenting + generating…" : "Run try-on"}
        </button>
      </form>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {result ? (
        <section className="flex flex-col gap-4">
          {result.gemini_image_error ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
              {result.gemini_image_error}
            </p>
          ) : null}

          <div>
            <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Garments from outfit ({result.outfit_summary.items.length})
            </h3>
            {typeof result.segments_sent_to_model === "number" &&
            typeof result.segments_detected === "number" &&
            result.segments_detected > 0 ? (
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Try-on model: {result.segments_sent_to_model} of {result.segments_detected} segments
                {result.segments_omitted ? (
                  <span className="text-amber-700 dark:text-amber-300">
                    {" "}
                    ({result.segments_omitted} not sent — raise <code className="text-xs">TRYON_MAX_SEGMENTS</code>)
                  </span>
                ) : null}
              </p>
            ) : null}
            {result.outfit_summary.segments_dir ? (
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Saved cutouts:{" "}
                <code className="break-all">{result.outfit_summary.segments_dir}</code>
                {result.outfit_summary.segment_manifest ? (
                  <>
                    {" "}
                    · <code className="text-xs">{result.outfit_summary.segment_manifest}</code>
                  </>
                ) : null}
              </p>
            ) : null}
            {result.outfit_summary.gemini_annotation_error ? (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                Annotation note: {result.outfit_summary.gemini_annotation_error}
              </p>
            ) : null}
            <ul className="mt-2 flex flex-col gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
              {result.outfit_summary.items.map((it) => (
                <li key={`g-${it.index}-${it.caption}`}>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{it.caption}</span>
                  {it.clothing?.body_region ? (
                    <span className="text-zinc-500 dark:text-zinc-400"> — {it.clothing.body_region}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          {resultSrc ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Result</h3>
              {result.gemini_image_model ? (
                <p className="text-xs text-zinc-500">
                  Image model: <code>{result.gemini_image_model}</code> · pieces used: {result.garments_applied}
                </p>
              ) : null}
              {result.image_model_text ? (
                <p className="text-xs text-zinc-600 dark:text-zinc-400">{result.image_model_text}</p>
              ) : null}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resultSrc}
                alt="Try-on result"
                className="max-h-[70vh] w-full rounded-lg border border-zinc-200 object-contain dark:border-zinc-700"
              />
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
