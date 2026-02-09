import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/server";
import {
  registerClient,
  unregisterClient,
} from "@/lib/notifications/broadcast";

// =============================================================================
// SSE NOTIFICATION STREAM ENDPOINT
// =============================================================================
// Provides real-time notifications via Server-Sent Events
// Replaces 30-second polling with instant delivery
// =============================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Authenticate user
  const session = await getSession();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId") || undefined;

  // Create SSE stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Register this client for broadcasts
      registerClient(userId, controller, tenantId);

      // Send initial connection message
      const connectMessage = JSON.stringify({
        type: "connected",
        userId,
        tenantId,
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(encoder.encode(`data: ${connectMessage}\n\n`));

      // Handle client disconnect via AbortSignal
      request.signal.addEventListener("abort", () => {
        unregisterClient(controller);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
    cancel() {
      // Stream cancelled by client
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
