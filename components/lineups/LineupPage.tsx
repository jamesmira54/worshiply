"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Link2, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { SLOTS, formatMonth, formatSunday } from "@/lib/lineups";
import type { Lineup, SlotKey } from "@/types/lineup";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SlotPicker } from "./SlotPicker";

type Result = { lineup: Lineup; canEdit: boolean };

export function LineupPage({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState("");
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState<{ slot: string; text: string; error: boolean } | null>(null);
  const [shareMessage, setShareMessage] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api<Result>(`/api/lineups/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [id]);
  async function assign(sunday: string, slot: SlotKey, songId: string | null) {
    const key = `${sunday}:${slot}`;
    setBusy(key);
    setFeedback(null);
    try {
      setData(
        await api<Result>(`/api/lineups/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ sunday, slot, songId }),
        }),
      );
      setPicking("");
      setFeedback({ slot: key, text: songId ? "Saved" : "Cleared", error: false });
    } catch (e) {
      setFeedback({
        slot: key,
        text: e instanceof Error ? e.message : "Could not save this slot.",
        error: true,
      });
    } finally {
      setBusy("");
    }
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareMessage("Link copied");
    } catch {
      window.prompt("Copy this lineup link", window.location.href);
      setShareMessage("Lineup link ready");
    }
  }
  async function remove() {
    setBusy("delete");
    setDeleteError("");
    try {
      await api(`/api/lineups/${encodeURIComponent(id)}`, { method: "DELETE" });
      router.push("/lineups");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete this lineup.");
      setBusy("");
    }
  }
  if (!data)
    return (
      <main className="state-panel">
        <h1>{error ? "Could not open this lineup" : "Opening the lineup…"}</h1>
        {error && (
          <>
            <p role="alert">{error}</p>
            <Link href="/lineups" className="button">
              Back to lineups
            </Link>
          </>
        )}
      </main>
    );
  const { lineup, canEdit } = data;
  return (
    <main className="song-view-page lineup-page">
      <div className="page-heading">
        <div>
          <Link href="/lineups" className="back-link no-print">
            <ArrowLeft size={14} /> Monthly lineups
          </Link>
          <h1>{formatMonth(lineup.month)}</h1>
          <p>{canEdit ? "Choose the songs for each Sunday." : "Sunday songs for the month."}</p>
        </div>
        <div className="page-actions no-print">
          <div className="action-menu">
            <button className="button" onClick={() => void copyLink()}>
              <Link2 size={16} /> Copy link
            </button>
            {shareMessage && (
              <span role="status" className="action-feedback">
                {shareMessage}
              </span>
            )}
          </div>
          {canEdit && (
            <button className="button" onClick={() => setDeleting(true)}>
              <Trash2 size={16} /> Delete
            </button>
          )}
        </div>
      </div>
      <div className="sunday-list">
        {lineup.sundays.map((sunday) => {
          const sundayLabel = formatSunday(sunday.date);
          return (
            <section className="sunday-card" key={sunday.date} aria-labelledby={`sunday-${sunday.date}`}>
              <h2 id={`sunday-${sunday.date}`}>{sundayLabel}</h2>
              <ol>
                {SLOTS.map((slot) => {
                  const key = `${sunday.date}:${slot.key}`;
                  const value = sunday.slots[slot.key];
                  const label = `${sundayLabel} - ${slot.label}`;
                  return (
                    <li className="slot-row" key={slot.key}>
                      <span className="slot-label">{slot.label}</span>
                      <div className="slot-value">
                        {value === null ? (
                          <span className="slot-empty">Not assigned</span>
                        ) : "removed" in value ? (
                          <span className="slot-removed">Song removed</span>
                        ) : (
                          <Link href={`/songs/${value.slug}?lineup=${lineup.id}`} className="slot-song">
                            <strong>{value.title}</strong>
                            <small>{value.artist || "Your arrangement"}</small>
                            <span className="key-badge">{value.defaultKey}</span>
                          </Link>
                        )}
                      </div>
                      {canEdit && (
                        <div className="slot-actions no-print">
                          <button
                            className="button quiet"
                            aria-expanded={picking === key}
                            aria-label={`${value && !("removed" in value) ? "Change" : "Choose"} ${label}`}
                            onClick={() => {
                              setFeedback(null);
                              setPicking(picking === key ? "" : key);
                            }}
                          >
                            {picking === key ? "Close" : value && !("removed" in value) ? "Change" : "Choose"}
                          </button>
                          {value && (
                            <button
                              className="icon-button"
                              aria-label={`Clear ${label}`}
                              disabled={busy === key}
                              onClick={() => void assign(sunday.date, slot.key, null)}
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      )}
                      {feedback?.slot === key && (
                        <p
                          className={feedback.error ? "slot-feedback error" : "slot-feedback"}
                          role="status"
                        >
                          {feedback.text}
                        </p>
                      )}
                      {canEdit && picking === key && (
                        <SlotPicker
                          label={label}
                          category={slot.category}
                          busy={busy === key}
                          onPick={(songId) => void assign(sunday.date, slot.key, songId)}
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
      {deleting && (
        <ConfirmDialog
          title={`Delete the ${formatMonth(lineup.month)} lineup?`}
          onCancel={() => {
            if (!busy) setDeleting(false);
          }}
        >
          <p>This removes the lineup and its shared link. The songs stay in your library.</p>
          {deleteError && (
            <p className="field-error" role="alert">
              {deleteError}
            </p>
          )}
          <div className="page-actions">
            <button autoFocus className="button" disabled={!!busy} onClick={() => setDeleting(false)}>
              Keep lineup
            </button>
            <button className="button danger" disabled={!!busy} onClick={() => void remove()}>
              <Trash2 size={16} /> Delete lineup
            </button>
          </div>
        </ConfirmDialog>
      )}
    </main>
  );
}
