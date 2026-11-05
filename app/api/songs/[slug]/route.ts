import { NextRequest, NextResponse } from "next/server";
import { deleteSong, findSong, updateSong } from "@/lib/server/db";
import { currentUser, requireAdmin } from "@/lib/server/auth";
import { apiError, checkOrigin, readBody } from "@/lib/server/http";
import { validateSong } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const { slug } = await context.params;
    const account = await currentUser(request);
    return NextResponse.json(await findSong(slug, account?.role === "admin"), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    requireAdmin(await currentUser(request));
    const { slug } = await context.params;
    const input = validateSong(await readBody(request));
    const song = await updateSong(slug, input);
    return NextResponse.json({ song, canEdit: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    checkOrigin(request);
    requireAdmin(await currentUser(request));
    const { slug } = await context.params;
    await deleteSong(slug);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
