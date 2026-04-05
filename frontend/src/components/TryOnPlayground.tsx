"use client";

import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const fileClass =
  "block w-full text-sm text-neo-mute file:mr-4 file:cursor-pointer file:border-[3px] file:border-neo-ink file:bg-neo-cyan file:px-4 file:py-2 file:text-sm file:font-bold file:text-neo-ink file:shadow-[4px_4px_0_0_var(--neo-ink)] file:transition-transform hover:file:translate-x-0.5 hover:file:translate-y-0.5 hover:file:shadow-[2px_2px_0_0_var(--neo-ink)]";

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
      <header className="neo-card-sm rounded-sm p-5">
        <p className="inline-block border-[2px] border-neo-ink bg-neo-lime px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-neo-ink">
          Try-on
        </p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-neo-ink">
          Virtual try-on (SAM 3 + image model)
        </h2>
        <p className="mt-2 text-sm font-medium leading-relaxed text-neo-mute">
          Upload a <strong className="text-neo-ink">user</strong> photo and an{" "}
          <strong className="text-neo-ink">outfit</strong> photo. Outfit is segmented on{" "}
          <span className="italic text-neo-ink">clothes</span> (all instances). Needs{" "}
          <code className="neo-code rounded-sm px-1 py-0.5 text-[11px]">GEMINI_API_KEY</code> and local{" "}
          <code className="neo-code rounded-sm px-1 py-0.5 text-[11px]">sam3.pt</code>.
        </p>
      </header>

      <form onSubmit={onSubmit} className="neo-card-sm flex flex-col gap-5 rounded-sm p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="tryon-user" className="text-sm font-bold text-neo-ink">
              User photo
            </label>
            <input
              id="tryon-user"
              name="user"
              type="file"
              accept="image/*"
              className={fileClass}
              onChange={(e) => setUserFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="tryon-outfit" className="text-sm font-bold text-neo-ink">
              Outfit photo
            </label>
            <input
              id="tryon-outfit"
              name="outfit"
              type="file"
              accept="image/*"
              className={fileClass}
              onChange={(e) => setOutfitFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        <div className="flex max-w-md flex-col gap-2">
          <label htmlFor="tryon-conf" className="text-sm font-bold text-neo-ink">
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
            className="h-3 w-full cursor-pointer accent-neo-accent"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-neo-ink">
          <input
            type="checkbox"
            checked={annotate}
            onChange={(e) => setAnnotate(e.target.checked)}
            className="h-4 w-4 rounded-sm border-[3px] border-neo-ink accent-neo-accent"
          />
          Label garments (Flash-Lite) to improve the try-on prompt
        </label>

        <button
          type="submit"
          disabled={loading || !userFile || !outfitFile}
          className="neo-btn neo-btn-yellow rounded-sm px-4 py-3 text-sm font-bold disabled:cursor-not-allowed"
        >
          {loading ? "Segmenting + generating…" : "Run try-on"}
        </button>
      </form>

      {error ? (
        <p className="border-[3px] border-neo-ink bg-neo-yellow/50 px-3 py-2 text-sm font-bold text-neo-ink shadow-[3px_3px_0_0_var(--neo-ink)]">
          {error}
        </p>
      ) : null}

      {result ? (
        <section className="flex flex-col gap-4">
          {result.gemini_image_error ? (
            <p className="border-[3px] border-neo-ink bg-neo-yellow/40 px-3 py-2 text-sm font-bold text-neo-ink shadow-[3px_3px_0_0_var(--neo-ink)]">
              {result.gemini_image_error}
            </p>
          ) : null}

          <div className="neo-card-sm rounded-sm p-5">
            <h3 className="text-sm font-bold text-neo-ink">
              Garments from outfit ({result.outfit_summary.items.length})
            </h3>
            {typeof result.segments_sent_to_model === "number" &&
            typeof result.segments_detected === "number" &&
            result.segments_detected > 0 ? (
              <p className="mt-1 text-xs font-medium text-neo-mute">
                Try-on model: {result.segments_sent_to_model} of {result.segments_detected} segments
                {result.segments_omitted ? (
                  <span className="text-neo-ink">
                    {" "}
                    ({result.segments_omitted} not sent — raise{" "}
                    <code className="neo-code rounded-sm px-1 text-[10px]">TRYON_MAX_SEGMENTS</code>)
                  </span>
                ) : null}
              </p>
            ) : null}
            {result.outfit_summary.segments_dir ? (
              <p className="mt-2 text-xs font-medium text-neo-mute">
                Saved cutouts:{" "}
                <code className="break-all font-mono text-[11px] text-neo-ink">{result.outfit_summary.segments_dir}</code>
                {result.outfit_summary.segment_manifest ? (
                  <>
                    {" "}
                    ·{" "}
                    <code className="font-mono text-[11px] text-neo-ink">{result.outfit_summary.segment_manifest}</code>
                  </>
                ) : null}
              </p>
            ) : null}
            {result.outfit_summary.gemini_annotation_error ? (
              <p className="mt-2 text-xs font-bold text-neo-accent">
                Annotation note: {result.outfit_summary.gemini_annotation_error}
              </p>
            ) : null}
            <ul className="mt-3 flex flex-col gap-2 text-sm font-medium text-neo-mute">
              {result.outfit_summary.items.map((it) => (
                <li key={`g-${it.index}-${it.caption}`} className="border-l-[3px] border-neo-ink pl-3">
                  <span className="font-bold text-neo-ink">{it.caption}</span>
                  {it.clothing?.body_region ? <span> — {it.clothing.body_region}</span> : null}
                </li>
              ))}
            </ul>
          </div>

          {resultSrc ? (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-bold text-neo-ink">Result</h3>
              {result.gemini_image_model ? (
                <p className="text-xs font-medium text-neo-mute">
                  Image model: <code className="font-mono text-neo-ink">{result.gemini_image_model}</code> · pieces used:{" "}
                  {result.garments_applied}
                </p>
              ) : null}
              {result.image_model_text ? (
                <p className="text-xs font-medium text-neo-mute">{result.image_model_text}</p>
              ) : null}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resultSrc}
                alt="Try-on result"
                className="max-h-[70vh] w-full border-[3px] border-neo-ink object-contain shadow-[6px_6px_0_0_var(--neo-ink)]"
              />
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
