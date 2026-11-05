"use client";
import { useId, useState } from "react";
import { ExternalLink, Play, X, Youtube } from "lucide-react";
import { canonicalVideoUrl, embedVideoUrl, youTubeId } from "@/lib/youtube";

// Nothing is requested from YouTube until the viewer presses Play here, and every
// URL below is rebuilt from the validated ID, never from the stored text.
export function ReferenceVideo({ url, title }: { url: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const headingId = useId();
  const playerId = useId();
  const id = youTubeId(url);
  if (!id) return null;
  return (
    <section className="reference-video no-print" aria-labelledby={headingId}>
      <div className="reference-video-bar">
        <h2 id={headingId}>
          <Youtube size={18} /> Reference video
        </h2>
        <div className="reference-video-actions">
          <button
            className="button"
            aria-expanded={playing}
            aria-controls={playerId}
            onClick={() => setPlaying(!playing)}
          >
            {playing ? <X size={16} /> : <Play size={16} />}
            {playing ? "Hide video" : "Play here"}
          </button>
          <a
            className="button quiet"
            href={canonicalVideoUrl(id)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={16} /> Open on YouTube
          </a>
        </div>
      </div>
      <div id={playerId} className="reference-video-frame" hidden={!playing}>
        {playing && (
          <iframe
            src={embedVideoUrl(id)}
            title={`Reference video: ${title || "Untitled song"}`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
      </div>
    </section>
  );
}
