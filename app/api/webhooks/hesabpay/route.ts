import { createHesabPayWebhookHandler } from "@/lib/payments/hesabpay/webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = createHesabPayWebhookHandler();

export async function GET() {
  return Response.json({
    status: "ok",
    message: "HesabPay webhook endpoint is active",
    gateway: "hesabpay",
    events: ["payment.success", "payment.failure"],
  });
}
