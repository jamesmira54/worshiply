"use client";
import { useState } from "react";
import { Link2, Share2 } from "lucide-react";
import { shareSong } from "@/lib/api";
export function ShareMenu({ slug, title }: { slug: string; title: string }) {
  const [message, setMessage] = useState("");
  async function share(native: boolean) {
    try {
      setMessage(await shareSong(slug, title, native));
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError"))
        setMessage("Sharing failed. Please try copying the link.");
    }
  }
  return (
    <div className="action-menu">
      <details>
        <summary className="button">
          <Share2 size={16} /> Share
        </summary>
        <div className="menu-popover">
          <button onClick={() => void share(false)}>
            <Link2 size={16} /> Copy link
          </button>
          <button onClick={() => void share(true)}>
            <Share2 size={16} /> Share with…
          </button>
        </div>
      </details>
      {message && (
        <span role="status" className="action-feedback">
          {message}
        </span>
      )}
    </div>
  );
}
