"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type Step = "name" | "fullbody" | "selfie" | "done";

export default function OnboardPage() {
  const router = useRouter();
  const { user, register, isAuthenticated } = useAuth();

  const [step, setStep] = useState<Step>(isAuthenticated ? "fullbody" : "name");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Full-body photo
  const [fullBodyFile, setFullBodyFile] = useState<File | null>(null);
  const [fullBodyPreview, setFullBodyPreview] = useState<string | null>(null);
  const [segmentCount, setSegmentCount] = useState(0);

  // Selfie
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);

  // ── Step 1: Name ──────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      await register(name.trim());
      setStep("fullbody");
    } catch {
      setError("Registration failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Full-body photo ───────────────────────────────────
  const handleFullBodySelect = (f: File | null) => {
    setFullBodyFile(f);
    setFullBodyPreview(f ? URL.createObjectURL(f) : null);
    setError("");
  };

  const handleFullBodyUpload = async () => {
    if (!fullBodyFile || !user) return;
    setLoading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", fullBodyFile);
      body.append("user_id", user.user_id);
      body.append("prompts", "clothes");
      body.append("conf", "0.60");

      const res = await fetch(`${API_BASE}/api/segment-and-store`, {
        method: "POST",
        headers: { Authorization: `Bearer ${user.token}` },
        body,
      });

      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(detail?.detail || `Failed (${res.status})`);
      }

      const data = await res.json();
      setSegmentCount(data.items_saved || 0);
      setStep("selfie");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Selfie ───────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch {
      setError("Camera access denied. You can upload a photo instead.");
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
        setSelfieFile(file);
        setSelfiePreview(URL.createObjectURL(file));
      }
    }, "image/jpeg", 0.9);

    // Stop camera
    const stream = videoRef.current.srcObject as MediaStream;
    stream?.getTracks().forEach((t) => t.stop());
    setCameraActive(false);
  };

  const handleSelfieUpload = async () => {
    if (!selfieFile || !user) return;
    setLoading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", selfieFile);

      const res = await fetch(`${API_BASE}/api/identity/enroll`, {
        method: "POST",
        headers: { Authorization: `Bearer ${user.token}` },
        body,
      });

      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { detail?: string } | null;
        // Non-fatal: face enrollment is optional (InsightFace may not be installed)
        console.warn("Face enroll:", detail?.detail || res.status);
      }

      setStep("done");
    } catch {
      // Selfie enrollment is optional — proceed anyway
      setStep("done");
    } finally {
      setLoading(false);
    }
  };

  const handleSkipSelfie = () => setStep("done");

  // ── Step 4: Done ──────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <svg className="h-8 w-8 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">You&apos;re all set, {user?.display_name}!</h1>
          <p className="mt-2 text-sm text-zinc-500">
            {segmentCount > 0
              ? `${segmentCount} clothing items from your photo are in your wardrobe.`
              : "Your account is ready."}
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-6 rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Open StyleMe
          </button>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Progress dots */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {(["name", "fullbody", "selfie"] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                step === s ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : (["name", "fullbody", "selfie"].indexOf(step) > i)
                  ? "bg-green-500 text-white"
                  : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700"
              }`}>
                {(["name", "fullbody", "selfie"].indexOf(step) > i) ? "✓" : i + 1}
              </div>
              {i < 2 && <div className="h-0.5 w-8 bg-zinc-200 dark:bg-zinc-700" />}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          {/* ── Step 1: Name ── */}
          {step === "name" && (
            <>
              <h1 className="text-xl font-bold text-center mb-1">Welcome to StyleMe</h1>
              <p className="text-zinc-500 text-center text-sm mb-5">What should we call you?</p>
              <form onSubmit={handleRegister} className="space-y-4">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  maxLength={50}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  autoFocus
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={!name.trim() || loading}
                  className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {loading ? "Creating account..." : "Next"}
                </button>
              </form>
            </>
          )}

          {/* ── Step 2: Full body photo ── */}
          {step === "fullbody" && (
            <>
              <h1 className="text-xl font-bold text-center mb-1">Upload a full-body photo</h1>
              <p className="text-zinc-500 text-center text-sm mb-5">
                We&apos;ll segment your clothes and add them to your wardrobe.
              </p>

              {fullBodyPreview ? (
                <div className="relative mb-4">
                  <img src={fullBodyPreview} alt="Preview" className="w-full max-h-72 rounded-lg object-contain bg-zinc-100 dark:bg-zinc-800" />
                  <button
                    onClick={() => { handleFullBodySelect(null); }}
                    className="absolute top-2 right-2 rounded-full bg-zinc-900/70 p-1 text-white hover:bg-zinc-900"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <label className="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 py-10 transition hover:border-zinc-400 dark:border-zinc-600">
                  <svg className="mb-2 h-10 w-10 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  <span className="text-sm text-zinc-500">Tap to upload a full-body photo</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFullBodySelect(e.target.files?.[0] || null)} />
                </label>
              )}

              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

              <div className="flex gap-2">
                <button
                  onClick={handleFullBodyUpload}
                  disabled={!fullBodyFile || loading}
                  className="flex-1 rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {loading ? "Segmenting clothes..." : "Scan my outfit"}
                </button>
                <button
                  onClick={() => setStep("selfie")}
                  className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400"
                >
                  Skip
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: Selfie ── */}
          {step === "selfie" && (
            <>
              <h1 className="text-xl font-bold text-center mb-1">Take a selfie</h1>
              <p className="text-zinc-500 text-center text-sm mb-5">
                Used for face-grounded segmentation in group photos. Optional.
              </p>

              {selfiePreview ? (
                <div className="relative mb-4">
                  <img src={selfiePreview} alt="Selfie" className="w-full max-h-64 rounded-lg object-cover bg-zinc-100 dark:bg-zinc-800" />
                  <button
                    onClick={() => { setSelfieFile(null); setSelfiePreview(null); }}
                    className="absolute top-2 right-2 rounded-full bg-zinc-900/70 p-1 text-white hover:bg-zinc-900"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : cameraActive ? (
                <div className="relative mb-4">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg bg-black" />
                  <button
                    onClick={capturePhoto}
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-zinc-900 shadow-lg transition hover:scale-105"
                  >
                    <div className="h-10 w-10 rounded-full bg-white" />
                  </button>
                </div>
              ) : (
                <div className="mb-4 flex gap-2">
                  <button
                    onClick={startCamera}
                    className="flex-1 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 py-8 transition hover:border-zinc-400 dark:border-zinc-600"
                  >
                    <svg className="mb-1 h-8 w-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                    <span className="text-xs text-zinc-500">Camera</span>
                  </button>
                  <label className="flex-1 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 py-8 cursor-pointer transition hover:border-zinc-400 dark:border-zinc-600">
                    <svg className="mb-1 h-8 w-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span className="text-xs text-zinc-500">Upload</span>
                    <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setSelfieFile(f);
                      setSelfiePreview(f ? URL.createObjectURL(f) : null);
                    }} />
                  </label>
                </div>
              )}

              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

              <div className="flex gap-2">
                <button
                  onClick={handleSelfieUpload}
                  disabled={!selfieFile || loading}
                  className="flex-1 rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {loading ? "Enrolling face..." : "Save selfie"}
                </button>
                <button
                  onClick={handleSkipSelfie}
                  className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400"
                >
                  Skip
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
