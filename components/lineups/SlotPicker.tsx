"use client";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import type { Song, SongCategory } from "@/types/song";

export function SlotPicker({
  label,
  category,
  busy,
  onPick,
}: {
  label: string;
  category: SongCategory | null;
  busy: boolean;
  onPick: (songId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ search, sort: "title", page: "1" });
      if (category) params.set("category", category);
      api<{ songs: Song[] }>(`/api/songs?${params}`, { signal: controller.signal })
        .then((data) => setSongs(data.songs))
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message);
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, category]);
  return (
    <div className="slot-picker">
      <label className="search-field">
        <Search size={16} />
        <input
          autoFocus
          type="search"
          aria-label={`Search songs for ${label}`}
          placeholder={category ? `Search ${category} songs` : "Search all songs"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : !songs ? (
        <p className="slot-hint" role="status">
          Loading songs…
        </p>
      ) : songs.length ? (
        <ul aria-label={`Songs for ${label}`}>
          {songs.map((song) => (
            <li key={song.id}>
              <button disabled={busy} onClick={() => onPick(song.id)}>
                <span>{song.title}</span>
                <small>{song.artist || "Your arrangement"}</small>
                <span className="key-badge">{song.defaultKey}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="slot-hint" role="status">
          {search
            ? "No songs match that search."
            : category
              ? `No ${category} songs yet.`
              : "No songs yet."}
        </p>
      )}
    </div>
  );
}
