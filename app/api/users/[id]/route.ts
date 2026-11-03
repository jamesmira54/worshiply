import { NextRequest, NextResponse } from "next/server";
import {
  currentUser,
  deleteUser,
  requireAdmin,
  resetPassword,
} from "@/lib/server/auth";
import { apiError, checkOrigin, readBody } from "@/lib/server/http";
import { ApiError, UUID_PATTERN } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

async function userId(context: Context) {
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id))
    throw new ApiError(404, "This user could not be found.");
  return id.toLowerCase();
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    requireAdmin(await currentUser(request));
    const id = await userId(context);
    const user = await resetPassword(id, await readBody(request));
    return NextResponse.json({ user });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    checkOrigin(request);
    requireAdmin(await currentUser(request));
    const id = await userId(context);
    await deleteUser(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
