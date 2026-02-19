import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { pushSubscriptions, tenantMembers, orders } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { parseDeviceName } from "@/lib/utils/device";

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { endpoint, keys, deviceName } = body as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    deviceName?: string;
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json(
      { error: "Missing subscription data" },
      { status: 400 }
    );
  }

  // Get tenants the user is a member of (store owners/staff)
  const memberships = await db.query.tenantMembers.findMany({
    where: eq(tenantMembers.userId, user.id),
    columns: { tenantId: true },
  });

  // Also get tenants the user has ordered from (customers)
  const customerOrders = await db
    .selectDistinct({ tenantId: orders.tenantId })
    .from(orders)
    .where(eq(orders.userId, user.id));

  // Merge both sets of tenant IDs
  const tenantIds = [
    ...new Set([
      ...memberships.map((m) => m.tenantId),
      ...customerOrders.map((o) => o.tenantId),
    ]),
  ];

  if (tenantIds.length === 0) {
    return NextResponse.json(
      { error: "No store associations found" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const resolvedDeviceName =
    deviceName || parseDeviceName(request.headers.get("user-agent"));
  const userAgent = request.headers.get("user-agent");

  // Upsert one subscription row per tenant
  await Promise.all(
    tenantIds.map(async (tenantId) => {
      const existing = await db.query.pushSubscriptions.findFirst({
        where: and(
          eq(pushSubscriptions.endpoint, endpoint),
          eq(pushSubscriptions.userId, user.id),
          eq(pushSubscriptions.tenantId, tenantId)
        ),
      });

      if (existing) {
        await db
          .update(pushSubscriptions)
          .set({
            p256dh: keys.p256dh,
            auth: keys.auth,
            isActive: true,
            failCount: 0,
            failedAt: null,
            deviceName: resolvedDeviceName || existing.deviceName,
            userAgent: userAgent || existing.userAgent,
            updatedAt: now,
          })
          .where(eq(pushSubscriptions.id, existing.id));
      } else {
        await db.insert(pushSubscriptions).values({
          userId: user.id,
          tenantId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          deviceName: resolvedDeviceName,
          userAgent,
          isActive: true,
          lastUsedAt: now,
          updatedAt: now,
        });
      }
    })
  );

  return NextResponse.json({ success: true });
}
