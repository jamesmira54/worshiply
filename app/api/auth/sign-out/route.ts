import { NextRequest, NextResponse } from "next/server";
import { signOut } from "@/lib/server/auth";
import {
  apiError,
  checkOrigin,
  clearSessionCookie,
  sessionToken,
} from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    await signOut(sessionToken(request));
    return clearSessionCookie(NextResponse.json({ success: true }), request);
  } catch (error) {
    return apiError(error);
  }
}
