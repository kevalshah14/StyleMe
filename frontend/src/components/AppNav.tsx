"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  {
    href: "/",
    label: "Chat",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: "/wardrobe",
    label: "Wardrobe",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9h18V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4Z" />
        <path d="M3 11v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8" />
        <path d="M12 3v18" />
      </svg>
    ),
  },
  {
    href: "/upload",
    label: "Upload",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
] as const;

export function AppNav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b-2 border-neo-border bg-neo-surface/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <Link href="/" className="group flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-neo-border bg-neo-accent shadow-[3px_3px_0_0_var(--neo-shadow)] transition-transform group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:shadow-[1px_1px_0_0_var(--neo-shadow)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3h12l3 6-9 13L3 9z" />
              </svg>
            </span>
            <span className="hidden text-lg font-bold tracking-tight text-neo-ink sm:block">
              StyleMe
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 sm:flex">
            {LINKS.map(({ href, label, icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition-all ${
                    active
                      ? "border-2 border-neo-border bg-neo-yellow text-neo-on-color shadow-[3px_3px_0_0_var(--neo-shadow)]"
                      : "border-2 border-transparent text-neo-mute hover:bg-neo-surface hover:text-neo-ink"
                  }`}
                >
                  {icon}
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {user && (
            <span className="hidden text-xs font-medium text-neo-mute lg:inline">
              <span className="font-bold text-neo-ink">{user.display_name}</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => signOut()}
            className="hidden rounded-lg border-2 border-neo-border bg-neo-surface px-3 py-1.5 text-xs font-bold text-neo-ink shadow-[3px_3px_0_0_var(--neo-shadow)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_0_var(--neo-shadow)] sm:block"
          >
            Sign out
          </button>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-neo-border bg-neo-surface shadow-[3px_3px_0_0_var(--neo-shadow)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_0_var(--neo-shadow)] sm:hidden"
            aria-label="Toggle menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              {mobileOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="4" y1="7" x2="20" y2="7" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="17" x2="20" y2="17" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="animate-fade-in border-t-2 border-neo-border bg-neo-surface px-4 pb-4 pt-2 sm:hidden">
          <nav className="flex flex-col gap-1">
            {LINKS.map(({ href, label, icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${
                    active
                      ? "border-2 border-neo-border bg-neo-yellow text-neo-on-color shadow-[3px_3px_0_0_var(--neo-shadow)]"
                      : "text-neo-mute hover:bg-neo-bg hover:text-neo-ink"
                  }`}
                >
                  {icon}
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-3 flex items-center justify-between border-t border-neo-border/40 pt-3">
            {user && (
              <span className="text-xs font-bold text-neo-ink">{user.display_name}</span>
            )}
            <button
              type="button"
              onClick={() => { signOut(); setMobileOpen(false); }}
              className="rounded-lg border-2 border-neo-border bg-neo-surface px-3 py-1.5 text-xs font-bold text-neo-ink shadow-[2px_2px_0_0_var(--neo-shadow)]"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
