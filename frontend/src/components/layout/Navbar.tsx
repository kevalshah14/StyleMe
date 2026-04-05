"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/upload", label: "Upload" },
  { href: "/wardrobe", label: "Wardrobe" },
  { href: "/recommend", label: "Style Me" },
  { href: "/chat", label: "Chat" },
  { href: "/style-dna", label: "Style DNA" },
  { href: "/inspect", label: "Inspect DB" },
];

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tight text-foreground">
          Style<span className="text-accent">Me</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {isAuthenticated &&
            NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? "bg-accent/20 text-foreground"
                    : "text-text-secondary hover:text-foreground hover:bg-accent/10"
                }`}
              >
                {link.label}
              </Link>
            ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-text-secondary">Hi, {user?.display_name}!</span>
              <button onClick={logout} className="text-sm text-text-secondary hover:text-foreground">
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/onboard"
              className="px-4 py-1.5 bg-accent text-white text-sm font-medium rounded-full hover:bg-accent/90 transition"
            >
              Get Started
            </Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-white px-4 pb-4 pt-2 space-y-1">
          {isAuthenticated ? (
            <>
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-2 rounded-lg text-sm ${
                    pathname === link.href ? "bg-accent/20 font-medium" : "text-text-secondary"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <button onClick={logout} className="block px-3 py-2 text-sm text-text-secondary">
                Logout
              </button>
            </>
          ) : (
            <Link href="/onboard" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm font-medium text-accent">
              Get Started
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
