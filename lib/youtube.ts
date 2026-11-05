// YouTube reference links. Shared by the editor, the server validator and the
// song page, so every URL the app renders is rebuilt from a validated video ID.

const VIDEO_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);
const PATH_FORMS = new Set(["shorts", "live", "embed"]);
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** The 11-character video ID from an accepted YouTube link, or null. */
export function youTubeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);
  let id: string | null = null;
  if (host === "youtu.be") {
    if (parts.length === 1) id = parts[0];
  } else if (VIDEO_HOSTS.has(host)) {
    if (parts.length === 1 && parts[0] === "watch") id = url.searchParams.get("v");
    else if (parts.length === 2 && PATH_FORMS.has(parts[0])) id = parts[1];
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

export const canonicalVideoUrl = (id: string) =>
  `https://www.youtube.com/watch?v=${id}`;

export const embedVideoUrl = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
