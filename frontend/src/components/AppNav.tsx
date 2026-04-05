"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Outfit chat" },
  { href: "/wardrobe", label: "Wardrobe" },
  { href: "/upload", label: "Upload" },
] as const;

export function AppNav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b-[3px] border-neo-ink bg-neo-surface shadow-[0_4px_0_0_var(--neo-ink)]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className="mr-2 border-[2px] border-neo-ink bg-neo-lime px-2 py-1 text-xs font-bold uppercase tracking-wider text-neo-ink shadow-[2px_2px_0_0_var(--neo-ink)]"
          >
            StyleMe
          </Link>
          <nav className="flex flex-wrap gap-1">
            {LINKS.map(({ href, label }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`rounded-sm px-3 py-1.5 text-sm font-bold transition-colors ${
                    active
                      ? "border-[2px] border-neo-ink bg-neo-yellow text-neo-ink shadow-[2px_2px_0_0_var(--neo-ink)]"
                      : "text-neo-mute hover:bg-neo-bg hover:text-neo-ink"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <span className="hidden text-xs font-bold text-neo-mute sm:inline">
              Hi, <span className="text-neo-ink">{user.display_name}</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => signOut()}
            className="neo-btn neo-btn-ghost rounded-sm px-3 py-1.5 text-xs font-bold"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
