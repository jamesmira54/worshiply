"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CalendarDays, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { formatMonth } from "@/lib/lineups";
import type { LineupSummary } from "@/types/lineup";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function LineupList() {
  const router = useRouter();
  const [lineups, setLineups] = useState<LineupSummary[] | null>(null);
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");
  const [revision, setRevision] = useState(0);
  const [month, setMonth] = useState("");
  const [busy, setBusy] = useState(false);
  // The page is prerendered, so the visitor's current month is only known after mount.
  useEffect(() => setMonth(currentMonth()), []);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    api<{ lineups: LineupSummary[] }>("/api/lineups", { signal: controller.signal })
      .then((data) => setLineups(data.lineups))
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [revision]);
  async function open(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setCreateError("");
    try {
      const result = await api<{ lineup: { id: string } }>("/api/lineups", {
        method: "POST",
        body: JSON.stringify({ month }),
      });
      router.push(`/lineups/${result.lineup.id}`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Could not open this month.");
      setBusy(false);
    }
  }
  return (
    <main className="library-page lineups-page">
      <div className="library-heading">
        <div>
          <div className="eyebrow">
            <span /> SUNDAY PLANNING
          </div>
          <h1>
            Monthly lineups<span>.</span>
          </h1>
          <p>Singspiration, two worship songs, and a closing song for every Sunday.</p>
        </div>
      </div>
      <form className="lineup-create" onSubmit={(e) => void open(e)}>
        <label className="filter-select">
          <span>Month</span>
          <input
            type="month"
            required
            min="2000-01"
            max="2100-12"
            value={month}
            aria-describedby={createError ? "lineup-create-error" : undefined}
            onChange={(e) => {
              setMonth(e.target.value);
              setCreateError("");
            }}
          />
        </label>
        <button className="button primary" disabled={busy || !month}>
          <Plus size={17} /> {busy ? "Opening…" : "Plan this month"}
        </button>
        {createError && (
          <p id="lineup-create-error" className="field-error" role="alert">
            {createError}
          </p>
        )}
      </form>
      {error && (
        <div className="notice error" role="alert">
          {error}
          <button onClick={() => setRevision((n) => n + 1)}>Retry</button>
        </div>
      )}
      {!lineups && !error ? (
        <p className="lineup-loading" role="status">
          Loading your lineups…
        </p>
      ) : lineups?.length ? (
        <ul className="lineup-grid">
          {lineups.map((lineup) => (
            <li key={lineup.id}>
              <Link className="lineup-card" href={`/lineups/${lineup.id}`}>
                <CalendarDays size={22} strokeWidth={1.6} />
                <span>
                  <strong>{formatMonth(lineup.month)}</strong>
                  <small>
                    Updated{" "}
                    {new Intl.DateTimeFormat("en", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }).format(new Date(lineup.updatedAt))}
                  </small>
                </span>
                <ArrowUpRight size={18} />
              </Link>
            </li>
          ))}
        </ul>
      ) : lineups ? (
        <div className="empty-library">
          <span className="empty-icon">
            <CalendarDays size={32} strokeWidth={1.4} />
          </span>
          <h2>No lineups yet.</h2>
          <p>Choose a month above to plan its Sunday songs.</p>
        </div>
      ) : null}
    </main>
  );
}
