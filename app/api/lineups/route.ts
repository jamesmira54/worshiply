import { NextRequest, NextResponse } from "next/server";
import { createLineup, listLineups } from "@/lib/server/db";
import { currentUser, requireAccount, requireAdmin } from "@/lib/server/auth";
import { apiError, readBody } from "@/lib/server/http";
import { ApiError, validateMonth } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    requireAccount(await currentUser(request));
    return NextResponse.json(
      { lineups: await listLineups() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireAdmin(await currentUser(request));
    const body = await readBody(request);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new ApiError(400, "Choose a valid month.");
    const month = validateMonth((body as Record<string, unknown>).month);
    const { lineup, created } = await createLineup(month);
    return NextResponse.json({ lineup }, { status: created ? 201 : 200 });
  } catch (error) {
    return apiError(error);
  }
}
