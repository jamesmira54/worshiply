import { NextRequest, NextResponse } from "next/server";
import { createSong, listSongs, newOwnerToken } from "@/lib/server/db";
import {
  apiError,
  OWNER_COOKIE,
  ownerToken,
  readBody,
} from "@/lib/server/http";
import { ApiError, validateSong } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const page = Number(params.get("page") || "1");
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
      throw new ApiError(400, "Choose a valid page.");
    const result = await listSongs(
      {
        search: (params.get("search") || "").slice(0, 160),
        key: (params.get("key") || "").slice(0, 4),
        sort: params.get("sort") || "updated",
        page,
      },
      ownerToken(request),
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = validateSong(await readBody(request));
    const token = ownerToken(request) || newOwnerToken();
    const song = await createSong(input, token);
    const response = NextResponse.json(
      { song, canEdit: true },
      { status: 201 },
    );
    response.cookies.set(OWNER_COOKIE, token, {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 5,
    });
    return response;
  } catch (error) {
    return apiError(error);
  }
}
