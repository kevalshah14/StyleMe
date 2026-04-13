"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export default function WaitlistButton({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const { error } = await supabase
      .from("waitlist")
      .insert({ email: email.trim().toLowerCase(), name: name.trim() || null });

    if (error) {
      if (error.code === "23505") {
        setStatus("success");
        return;
      }
      setErrorMsg(error.message);
      setStatus("error");
      return;
    }
    setStatus("success");
  }

  function handleClose() {
    setOpen(false);
    if (status === "success") {
      setEmail("");
      setName("");
      setStatus("idle");
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={className}>
        {children}
      </button>

      <dialog
        ref={dialogRef}
        onClose={handleClose}
        className="m-auto w-full max-w-md border-0 bg-transparent p-4 backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        <div className="border-3 border-[var(--neo-border)] bg-[var(--neo-surface)] shadow-[6px_6px_0_0_var(--neo-shadow)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-[var(--neo-border)] px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[var(--neo-accent)]" />
              <div className="h-3 w-3 bg-[var(--neo-yellow)]" />
              <div className="h-3 w-3 rounded-full bg-[var(--neo-blue)]" />
            </div>
            <button
              onClick={handleClose}
              className="text-xs font-extrabold uppercase tracking-wider text-[var(--neo-mute)] transition-colors hover:text-[var(--neo-ink)]"
            >
              Close
            </button>
          </div>

          <div className="px-6 py-6">
            {status === "success" ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center border-3 border-[var(--neo-border)] bg-[var(--neo-lime)] shadow-[3px_3px_0_0_var(--neo-shadow)]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight text-[var(--neo-ink)]">
                  You&apos;re on the list!
                </h3>
                <p className="text-sm font-medium text-[var(--neo-mute)]">
                  We&apos;ll notify you as soon as StyleMe launches.
                </p>
                <button
                  onClick={handleClose}
                  className="neo-btn bg-[var(--neo-accent)] px-8 py-3 text-sm text-white"
                >
                  Got It
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-black uppercase tracking-tight text-[var(--neo-ink)]">
                  Join the Waitlist
                </h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--neo-mute)]">
                  Be the first to know when StyleMe launches. Early access, no spam.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-widest text-[var(--neo-mute)]">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full border-2 border-[var(--neo-border)] bg-[var(--neo-bg)] px-4 py-3 text-sm font-medium text-[var(--neo-ink)] shadow-[2px_2px_0_0_var(--neo-shadow)] outline-none placeholder:text-[var(--neo-mute)] focus:border-[var(--neo-accent)]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-widest text-[var(--neo-mute)]">
                      Name <span className="normal-case tracking-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="w-full border-2 border-[var(--neo-border)] bg-[var(--neo-bg)] px-4 py-3 text-sm font-medium text-[var(--neo-ink)] shadow-[2px_2px_0_0_var(--neo-shadow)] outline-none placeholder:text-[var(--neo-mute)] focus:border-[var(--neo-accent)]"
                    />
                  </div>

                  {status === "error" && (
                    <div className="border-2 border-[var(--neo-accent)] bg-[var(--neo-pink-soft)] px-4 py-2">
                      <p className="text-xs font-bold text-[var(--neo-accent)]">{errorMsg}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="neo-btn bg-[var(--neo-accent)] px-8 py-3.5 text-sm text-white disabled:opacity-60"
                  >
                    {status === "loading" ? "Joining..." : "Join Waitlist"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
