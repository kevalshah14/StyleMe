"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { uploadPhotos, confirmGarments } from "@/lib/api";
import type { GarmentUploadItem, GarmentConfirmItem } from "@/lib/types";

const SEASONS = ["spring", "summer", "fall", "winter"];

export default function UploadPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [items, setItems] = useState<GarmentUploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<"pick" | "review" | "done">("pick");
  const [error, setError] = useState("");

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const arr = Array.from(newFiles).filter((f) => f.type.startsWith("image/")).slice(0, 20);
    setFiles((prev) => [...prev, ...arr].slice(0, 20));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      const result = await uploadPhotos(files);
      setItems(result);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.garment_id !== id));
  };

  const updateField = (id: string, field: string, value: unknown) => {
    setItems((prev) =>
      prev.map((item) =>
        item.garment_id === id
          ? { ...item, extracted: { ...item.extracted, [field]: value } }
          : item
      )
    );
  };

  const toggleSeason = (id: string, season: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.garment_id !== id) return item;
        const seasons = item.extracted.season.includes(season)
          ? item.extracted.season.filter((s) => s !== season)
          : [...item.extracted.season, season];
        return { ...item, extracted: { ...item.extracted, season: seasons } };
      })
    );
  };

  const handleConfirmAll = async () => {
    setSaving(true);
    setError("");
    try {
      const confirmItems: GarmentConfirmItem[] = items.map((i) => ({
        garment_id: i.garment_id,
        image_base64: i.image_base64,
        ...i.extracted,
      }));
      const result = await confirmGarments(confirmItems);
      if ((result.failed || 0) > 0) {
        const failed = result.failed || 0;
        setError(`Saved ${result.saved} item(s), but ${failed} failed to store in HydraDB. Retry confirm for failed items.`);
      }
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return null;
  if (!isAuthenticated) {
    router.push("/onboard");
    return null;
  }

  if (step === "done") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-success/20 text-success flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">{items.length} items saved to your wardrobe!</h1>
        <p className="text-text-secondary mb-8">Embeddings generated and stored in HydraDB.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => { setStep("pick"); setFiles([]); setItems([]); }} className="px-6 py-2.5 border border-border rounded-full text-sm font-medium hover:bg-accent/5 transition">
            Upload More
          </button>
          <button onClick={() => router.push("/recommend")} className="px-6 py-2.5 bg-accent text-white rounded-full text-sm font-medium hover:bg-accent/90 transition">
            Style Me
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-1">Upload Your Clothes</h1>
      <p className="text-text-secondary text-sm mb-8">
        Drag photos of your clothing items. AI will extract every detail.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-error/10 text-error text-sm rounded-xl">{error}</div>
      )}

      {step === "pick" && (
        <>
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-border rounded-2xl p-12 text-center hover:border-accent/50 hover:bg-accent/5 transition cursor-pointer"
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <svg className="w-12 h-12 text-text-secondary/40 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
            </svg>
            <p className="font-medium mb-1">Drag photos here or click to browse</p>
            <p className="text-sm text-text-secondary">JPEG, PNG, WEBP up to 20 images</p>
            <input
              id="file-input"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {/* Preview thumbnails */}
          {files.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium mb-3">{files.length} file(s) selected</p>
              <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                {files.map((f, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden bg-border/30 relative group">
                    <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={(e) => { e.stopPropagation(); setFiles((prev) => prev.filter((_, j) => j !== i)); }}
                      className="absolute top-1 right-1 w-6 h-6 bg-foreground/70 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="mt-6 px-8 py-2.5 bg-accent text-white font-semibold rounded-full hover:bg-accent/90 disabled:opacity-50 transition"
              >
                {uploading ? "AI is analyzing..." : `Analyze ${files.length} Photo${files.length > 1 ? "s" : ""}`}
              </button>
            </div>
          )}

          {uploading && (
            <div className="mt-8 space-y-3">
              {[...Array(Math.min(files.length, 3))].map((_, i) => (
                <div key={i} className="h-24 skeleton rounded-xl" />
              ))}
            </div>
          )}
        </>
      )}

      {step === "review" && (
        <>
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-text-secondary">{items.length} items extracted. Review and confirm.</p>
            <button
              onClick={handleConfirmAll}
              disabled={saving || items.length === 0}
              className="px-6 py-2 bg-accent text-white font-semibold rounded-full text-sm hover:bg-accent/90 disabled:opacity-50 transition"
            >
              {saving ? "Generating embeddings..." : `Confirm All (${items.length})`}
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={item.garment_id} className="bg-surface rounded-2xl border border-border p-4 md:p-6 animate-fade-in-up" style={{ animationDelay: `${idx * 100}ms` }}>
                <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                  {/* Image */}
                  <div className="w-full md:w-40 h-40 rounded-xl overflow-hidden bg-border/20 flex-shrink-0">
                    <img src={item.image_base64} alt="" className="w-full h-full object-cover" />
                  </div>

                  {/* Fields */}
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-text-secondary">Type</label>
                        <input
                          value={item.extracted.garment_type}
                          onChange={(e) => updateField(item.garment_id, "garment_type", e.target.value)}
                          className="w-full px-2 py-1 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-text-secondary">Color</label>
                        <div className="flex gap-1.5 items-center">
                          <span className="w-5 h-5 rounded border border-border flex-shrink-0" style={{ background: item.extracted.color_hex }} />
                          <input
                            value={item.extracted.primary_color}
                            onChange={(e) => updateField(item.garment_id, "primary_color", e.target.value)}
                            className="w-full px-2 py-1 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-1 focus:ring-accent"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-text-secondary">Pattern</label>
                        <input
                          value={item.extracted.pattern}
                          onChange={(e) => updateField(item.garment_id, "pattern", e.target.value)}
                          className="w-full px-2 py-1 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                      </div>
                    </div>

                    {/* Seasons */}
                    <div>
                      <label className="text-xs text-text-secondary">Season</label>
                      <div className="flex gap-2 mt-1">
                        {SEASONS.map((s) => (
                          <button
                            key={s}
                            onClick={() => toggleSeason(item.garment_id, s)}
                            className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition ${
                              item.extracted.season.includes(s)
                                ? "bg-accent text-white"
                                : "bg-border/40 text-text-secondary hover:bg-border"
                            }`}
                          >
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Formality */}
                    <div>
                      <label className="text-xs text-text-secondary">Formality: {item.extracted.formality_level}/10</label>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={item.extracted.formality_level}
                        onChange={(e) => updateField(item.garment_id, "formality_level", parseInt(e.target.value))}
                        className="w-full accent-accent"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="text-xs text-text-secondary">Description</label>
                      <textarea
                        value={item.extracted.description}
                        onChange={(e) => updateField(item.garment_id, "description", e.target.value)}
                        rows={2}
                        className="w-full px-2 py-1 border border-border rounded-lg text-sm bg-background resize-none focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {item.extracted.style_tags.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 bg-accent/10 text-accent rounded-full text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => removeItem(item.garment_id)}
                    className="self-start p-2 text-text-secondary hover:text-error transition"
                    title="Remove"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
