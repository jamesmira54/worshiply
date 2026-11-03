import { NextRequest, NextResponse } from "next/server";
import {
  createUser,
  currentUser,
  listUsers,
  requireAdmin,
} from "@/lib/server/auth";
import { apiError, readBody } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    requireAdmin(await currentUser(request));
    return NextResponse.json(
      { users: await listUsers() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireAdmin(await currentUser(request));
    const user = await createUser(await readBody(request));
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
