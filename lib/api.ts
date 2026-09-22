export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : "Unable to complete this request. Please try again.",
    );
  return data as T;
}

export async function shareSong(slug: string, title: string, native = false) {
  const url = new URL(
    `/songs/${encodeURIComponent(slug)}`,
    window.location.origin,
  ).href;
  if (native && navigator.share) {
    await navigator.share({ title, url });
    return "Shared";
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return "Link copied";
  }
  window.prompt("Copy this song link", url);
  return "Song link ready";
}
