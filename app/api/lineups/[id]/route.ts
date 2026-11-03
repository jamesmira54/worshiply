import { NextRequest, NextResponse } from "next/server";
import { assignSlot, deleteLineup, findLineup } from "@/lib/server/db";
import { currentUser, requireAccount, requireAdmin } from "@/lib/server/auth";
import { apiError, checkOrigin, readBody } from "@/lib/server/http";
import { ApiError, UUID_PATTERN } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

async function lineupId(context: Context) {
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id))
    throw new ApiError(404, "This lineup could not be found.");
  return id.toLowerCase();
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const account = await currentUser(request);
    requireAccount(account);
    const id = await lineupId(context);
    return NextResponse.json(await findLineup(id, account.role === "admin"), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    requireAdmin(await currentUser(request));
    const id = await lineupId(context);
    const body = await readBody(request);
    return NextResponse.json(await assignSlot(id, body));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    checkOrigin(request);
    requireAdmin(await currentUser(request));
    const id = await lineupId(context);
    await deleteLineup(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
