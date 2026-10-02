import { NextRequest, NextResponse } from "next/server";
import { createLineup, listLineups, newOwnerToken } from "@/lib/server/db";
import { apiError, ownerToken, readBody, setOwnerCookie } from "@/lib/server/http";
import { ApiError, validateMonth } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(
      { lineups: await listLineups(ownerToken(request)) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new ApiError(400, "Choose a valid month.");
    const month = validateMonth((body as Record<string, unknown>).month);
    const token = ownerToken(request) || newOwnerToken();
    const { lineup, created } = await createLineup(month, token);
    return setOwnerCookie(
      NextResponse.json({ lineup }, { status: created ? 201 : 200 }),
      request,
      token,
    );
  } catch (error) {
    return apiError(error);
  }
}
