import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await db
    .update(notifications)
    .set({ readAt: sql`now()` })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.userId, user.id),
        isNull(notifications.readAt)
      )
    );

  return NextResponse.json({ success: true });
}
