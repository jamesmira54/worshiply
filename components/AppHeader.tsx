"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Music2,
  Library,
  PenLine,
  CalendarDays,
  Users,
  LogIn,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import type { Account } from "@/types/user";
import { api } from "@/lib/api";

export function AppHeader({
  account,
}: {
  account: Pick<Account, "username" | "role"> | null;
}) {
  const path = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  // The small-screen menu closes on navigation, Escape, or a tap outside it.
  useEffect(() => setMenuOpen(false), [path]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      toggle.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [menuOpen]);
  const editor = path.includes("/edit") || path === "/songs/new";
  const lineups = path.startsWith("/lineups");
  const users = path.startsWith("/users");
  const admin = account?.role === "admin";
  async function signOut() {
    setBusy(true);
    try {
      await api("/api/auth/sign-out", { method: "POST" });
      router.push("/songs");
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not sign out.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <header ref={header} className="app-header no-print">
      <Link href="/songs" className="brand" aria-label="Worshiply song library">
        <span className="brand-mark">
          <Music2 size={23} strokeWidth={1.8} />
        </span>{" "}
        worshiply<span className="brand-period">.</span>
      </Link>
      <button
        ref={toggle}
        className="icon-button menu-toggle"
        aria-expanded={menuOpen}
        aria-controls="main-menu"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        {menuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>
      {/* On wide screens this wrapper is invisible to layout (display: contents). */}
      <div id="main-menu" className={`header-menu${menuOpen ? " open" : ""}`}>
        <nav aria-label="Main navigation">
          <Link
            href="/songs"
            className={!editor && !lineups && !users ? "active" : ""}
          >
            <Library size={17} /> Songs
          </Link>
          {admin && (
            <Link href="/songs/new" className={editor ? "active" : ""}>
              <PenLine size={17} /> Editor
            </Link>
          )}
          {account && (
            <Link href="/lineups" className={lineups ? "active" : ""}>
              <CalendarDays size={17} /> Lineups
            </Link>
          )}
          {admin && (
            <Link href="/users" className={users ? "active" : ""}>
              <Users size={17} /> Users
            </Link>
          )}
        </nav>
        <span className="header-note">
          Made for the music. <span>And the moments.</span>
        </span>
        <div className="header-account">
          {account ? (
            <>
              <span className="header-user">{account.username}</span>
              <button
                className="button quiet"
                aria-label={`Sign out ${account.username}`}
                disabled={busy}
                onClick={() => void signOut()}
              >
                <LogOut size={16} /> <span>Sign out</span>
              </button>
            </>
          ) : (
            <Link
              className="button quiet"
              aria-label="Sign in"
              href={
                path === "/sign-in"
                  ? "/sign-in"
                  : `/sign-in?next=${encodeURIComponent(path)}`
              }
            >
              <LogIn size={16} /> <span>Sign in</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
