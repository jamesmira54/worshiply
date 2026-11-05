"use client";
import { useState } from "react";
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
    <header className="app-header no-print">
      <Link href="/songs" className="brand" aria-label="Worshiply song library">
        <span className="brand-mark">
          <Music2 size={23} strokeWidth={1.8} />
        </span>{" "}
        worshiply<span className="brand-period">.</span>
      </Link>
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
    </header>
  );
}
