"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/", label: "Chat", shape: "circle" as const, color: "bg-neo-accent" },
  { href: "/wardrobe", label: "Wardrobe", shape: "square" as const, color: "bg-neo-yellow" },
  { href: "/upload", label: "Upload", shape: "triangle" as const, color: "bg-neo-blue" },
] as const;

function BauhausShape({ shape, size = 10, className = "" }: { shape: "circle" | "square" | "triangle"; size?: number; className?: string }) {
  if (shape === "circle") return <div className={`rounded-full border-2 border-current ${className}`} style={{ width: size, height: size }} />;
  if (shape === "triangle") return (
    <div className={className} style={{ width: 0, height: 0, borderLeft: `${size/2}px solid transparent`, borderRight: `${size/2}px solid transparent`, borderBottom: `${size}px solid currentColor` }} />
  );
  return <div className={`border-2 border-current ${className}`} style={{ width: size, height: size }} />;
}

export function AppNav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b-3 border-neo-border bg-neo-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-5">
          <Link href="/" className="group flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center border-3 border-neo-border bg-neo-accent shadow-[4px_4px_0_0_var(--neo-shadow)] transition-all duration-200 group-hover:translate-x-[2px] group-hover:translate-y-[2px] group-hover:shadow-[2px_2px_0_0_var(--neo-shadow)] group-hover:rotate-3">
              <div className="h-4 w-4 rounded-full bg-white transition-transform group-hover:scale-110" />
            </div>
            <span className="hidden text-xl font-black uppercase tracking-tight text-neo-ink sm:block">
              Style<span className="text-neo-accent">Me</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            {LINKS.map(({ href, label, shape, color }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`group/link flex items-center gap-2 px-4 py-2 text-xs font-extrabold uppercase tracking-wider transition-all duration-150 ${
                    active
                      ? "border-3 border-neo-border bg-neo-yellow text-neo-on-color shadow-[3px_3px_0_0_var(--neo-shadow)]"
                      : "border-3 border-transparent text-neo-mute hover:text-neo-ink hover:bg-neo-yellow-soft"
                  }`}
                >
                  <span className={`transition-transform duration-150 group-hover/link:scale-125 ${active ? "" : ""}`}>
                    <BauhausShape shape={shape} size={active ? 10 : 8} />
                  </span>
                  {label}
                  {active && <div className={`ml-1 h-1.5 w-1.5 rounded-full ${color} animate-pulse-soft`} />}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <span className="hidden items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neo-mute lg:inline-flex">
              <div className="h-2 w-2 rounded-full bg-neo-lime" />
              {user.display_name}
            </span>
          )}
          <button
            type="button"
            onClick={() => signOut()}
            className="hidden border-2 border-neo-border bg-neo-surface px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-neo-ink shadow-[3px_3px_0_0_var(--neo-shadow)] transition-all duration-150 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_0_var(--neo-shadow)] sm:block"
          >
            Sign out
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="flex h-10 w-10 items-center justify-center border-3 border-neo-border bg-neo-surface shadow-[3px_3px_0_0_var(--neo-shadow)] transition-all duration-150 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_0_var(--neo-shadow)] sm:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="16" y2="12" /><line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="animate-slide-down border-t-3 border-neo-border bg-neo-surface px-4 pb-4 pt-2 sm:hidden">
          <nav className="flex flex-col gap-1">
            {LINKS.map(({ href, label, shape, color }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 text-sm font-extrabold uppercase tracking-wider transition-all ${
                    active
                      ? "border-3 border-neo-border bg-neo-yellow text-neo-on-color shadow-[3px_3px_0_0_var(--neo-shadow)]"
                      : "text-neo-mute hover:text-neo-ink hover:bg-neo-yellow-soft"
                  }`}
                >
                  <BauhausShape shape={shape} size={12} />
                  {label}
                  {active && <div className={`ml-auto h-2 w-2 rounded-full ${color}`} />}
                </Link>
              );
            })}
          </nav>
          <div className="mt-3 flex items-center justify-between border-t-2 border-neo-border pt-3">
            {user && (
              <span className="flex items-center gap-2 text-xs font-bold uppercase text-neo-ink">
                <div className="h-2 w-2 rounded-full bg-neo-lime" />
                {user.display_name}
              </span>
            )}
            <button
              type="button"
              onClick={() => { signOut(); setMobileOpen(false); }}
              className="border-2 border-neo-border bg-neo-surface px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-neo-ink shadow-[2px_2px_0_0_var(--neo-shadow)]"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
