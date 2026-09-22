import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "./validation";

export const OWNER_COOKIE = "worshiply_owner";
export function ownerToken(request: NextRequest) {
  const token = request.cookies.get(OWNER_COOKIE)?.value;
  return token && /^[a-f0-9]{64}$/.test(token) ? token : undefined;
}
export function checkOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  // Next's internal URL can use its bind address (0.0.0.0) rather than the
  // browser-facing host. Compare the actual request authority; never trust a
  // forwarded host supplied by a client. Deployments can pin APP_ORIGIN.
  let matches = !origin;
  if (origin) {
    try {
      const parsed = new URL(origin);
      matches = process.env.APP_ORIGIN
        ? parsed.origin === new URL(process.env.APP_ORIGIN).origin
        : parsed.host === request.headers.get("host") &&
          ["http:", "https:"].includes(parsed.protocol);
    } catch {
      matches = false;
    }
  }
  if (request.headers.get("sec-fetch-site") === "cross-site" || !matches)
    throw new ApiError(403, "Cross-origin changes are not allowed.");
}
export async function readBody(request: NextRequest): Promise<unknown> {
  checkOrigin(request);
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ApiError(415, "Send the song as JSON.");
  const maxBytes = 300000;
  if (Number(request.headers.get("content-length")) > maxBytes)
    throw new ApiError(413, "This song is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Provide a song to save.");
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new ApiError(413, "This song is too large.");
    }
    parts.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch {
    throw new ApiError(400, "The song contains invalid JSON.");
  }
}
export function apiError(error: unknown) {
  if (error instanceof ApiError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  console.error("Song API operation failed", {
    type: error instanceof Error ? error.name : "UnknownError",
  });
  return NextResponse.json(
    { error: "We could not complete that request. Please try again." },
    { status: 500 },
  );
}
