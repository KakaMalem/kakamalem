import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// =============================================================================
// ARCHIVE NOTIFICATION API ROUTE
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Archive notification (only if it belongs to the user)
    await db
      .update(notifications)
      .set({
        archivedAt: new Date().toISOString(),
      })
      .where(
        and(eq(notifications.id, id), eq(notifications.userId, session.user.id))
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Archive notification error:", error);
    return NextResponse.json(
      { error: "Failed to archive notification" },
      { status: 500 }
    );
  }
}

// Unarchive notification
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Unarchive notification (only if it belongs to the user)
    await db
      .update(notifications)
      .set({
        archivedAt: null,
      })
      .where(
        and(eq(notifications.id, id), eq(notifications.userId, session.user.id))
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unarchive notification error:", error);
    return NextResponse.json(
      { error: "Failed to unarchive notification" },
      { status: 500 }
    );
  }
}
