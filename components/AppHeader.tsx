"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Music2, Library, PenLine } from "lucide-react";

export function AppHeader() {
  const path = usePathname();
  const editor = path.includes("/edit") || path === "/songs/new";
  return (
    <header className="app-header no-print">
      <Link href="/songs" className="brand" aria-label="Worshiply song library">
        <span className="brand-mark">
          <Music2 size={23} strokeWidth={1.8} />
        </span>{" "}
        worshiply<span className="brand-period">.</span>
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/songs" className={!editor ? "active" : ""}>
          <Library size={17} /> Songs
        </Link>
        <Link href="/songs/new" className={editor ? "active" : ""}>
          <PenLine size={17} /> Editor
        </Link>
      </nav>
      <span className="header-note">
        Made for the music. <span>And the moments.</span>
      </span>
    </header>
  );
}
