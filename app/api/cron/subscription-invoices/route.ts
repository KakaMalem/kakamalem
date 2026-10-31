import { NextResponse } from "next/server";
import { processSubscriptionInvoiceJob } from "@/lib/invoice/subscription-invoice-worker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/** Schedule every minute. Each invocation drains one job; overlap is safe. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processSubscriptionInvoiceJob();
    return NextResponse.json(result, {
      status: result.status === "retrying" ? 503 : 200,
    });
  } catch (error) {
    console.error("[SubscriptionInvoiceWorker] Worker failed", error);
    return NextResponse.json(
      { error: "Invoice worker failed" },
      { status: 500 }
    );
  }
}
