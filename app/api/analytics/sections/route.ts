import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { storefrontSectionEvents, tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

const MAX_EVENTS_PER_BATCH = 50;

interface SectionEvent {
  sectionType: string;
  sectionIndex: number;
  eventType: "impression" | "click";
}

interface SectionEventBody {
  tenantId: string;
  pageType: string;
  events: SectionEvent[];
}

export async function POST(request: NextRequest) {
  let body: SectionEventBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { tenantId, pageType, events } = body;

  if (!tenantId || !pageType || !Array.isArray(events) || events.length === 0) {
    return NextResponse.json(
      { error: "tenantId, pageType, and events are required" },
      { status: 400 }
    );
  }

  if (events.length > MAX_EVENTS_PER_BATCH) {
    return NextResponse.json(
      { error: `Maximum ${MAX_EVENTS_PER_BATCH} events per batch` },
      { status: 400 }
    );
  }

  // Validate each event
  for (const event of events) {
    if (
      !event.sectionType ||
      typeof event.sectionIndex !== "number" ||
      !["impression", "click"].includes(event.eventType)
    ) {
      return NextResponse.json(
        { error: "Invalid event format" },
        { status: 400 }
      );
    }
  }

  // Read visitor ID from cookie
  const cookieStore = await cookies();
  let visitorId = cookieStore.get("km_vid")?.value;
  if (!visitorId) {
    visitorId = crypto.randomUUID();
  }

  // Generate session ID from request (simple hash of visitor + user agent)
  const ua = request.headers.get("user-agent") || "";
  const sessionId = `${visitorId}-${hashSimple(ua + new Date().toDateString())}`;

  // Verify tenant exists (fast check)
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: { id: true },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // Insert all events
  await db.insert(storefrontSectionEvents).values(
    events.map((event) => ({
      tenantId,
      pageType,
      sectionType: event.sectionType,
      sectionIndex: event.sectionIndex,
      eventType: event.eventType as "impression" | "click",
      visitorId,
      sessionId,
    }))
  );

  // Set km_vid cookie if not present (backup for proxy)
  const response = NextResponse.json({ ok: true });
  if (!cookieStore.get("km_vid")) {
    response.cookies.set("km_vid", visitorId!, {
      maxAge: 365 * 24 * 60 * 60,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }

  return response;
}

/** Simple string hash for session IDs */
function hashSimple(str: string): string {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0; // FNV prime
  }
  return hash.toString(36);
}
