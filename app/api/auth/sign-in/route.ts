import { NextRequest, NextResponse } from "next/server";
import { signIn } from "@/lib/server/auth";
import { apiError, readBody, setSessionCookie } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { token, account } = await signIn(await readBody(request));
    return setSessionCookie(
      NextResponse.json({
        user: { username: account.username, role: account.role },
      }),
      request,
      token,
    );
  } catch (error) {
    return apiError(error);
  }
}
