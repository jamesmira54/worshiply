"use client";
import { useState, useRef } from "react";
import { Download, FileText, Printer, ChevronDown } from "lucide-react";
import type { SongInput } from "@/types/song";
export function ExportMenu({ song, allowPrint = true }: { song: SongInput; allowPrint?: boolean }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function download(format: "pdf" | "docx") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (format === "pdf") {
        const { exportPdf } = await import("@/lib/export/pdf");
        await exportPdf(song);
      } else {
        const { exportDocx } = await import("@/lib/export/docx");
        await exportDocx(song);
      }
      setMessage(`${format === "pdf" ? "PDF" : "Word document"} ready`);
      if (menu.current) menu.current.open = false;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Export failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="action-menu">
      <details ref={menu}>
        <summary className="button" aria-label="Export song">
          <Download size={16} /> {busy ? "Preparing…" : "Export"}
          <ChevronDown size={14} />
        </summary>
        <div className="menu-popover">
          <button disabled={busy} onClick={() => void download("pdf")}>
            <FileText size={16} /> PDF document
          </button>
          <button disabled={busy} onClick={() => void download("docx")}>
            <FileText size={16} /> Word document (.docx)
          </button>
          {allowPrint && <button onClick={() => window.print()}>
            <Printer size={16} /> Print chord sheet
          </button>}
        </div>
      </details>
      {error ? (
        <span className="action-feedback error" role="alert">
          {error}
        </span>
      ) : (
        message && (
          <span className="action-feedback" role="status">
            {message}
          </span>
        )
      )}
    </div>
  );
}
