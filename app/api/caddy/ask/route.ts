import { NextResponse } from "next/server";
import { shouldProvisionCertificate } from "@/lib/services/cloudflare";

/**
 * Caddy On-Demand TLS Validation Endpoint
 *
 * Caddy calls this endpoint before provisioning a TLS certificate.
 * If we return 200, Caddy proceeds with Let's Encrypt certificate issuance.
 * If we return 404, Caddy rejects the request.
 *
 * @see https://caddyserver.com/docs/automatic-https#on-demand-tls
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain");

  if (!domain) {
    return NextResponse.json(
      { error: "Missing domain parameter" },
      { status: 400 }
    );
  }

  const approved = await shouldProvisionCertificate(domain);

  if (approved) {
    return NextResponse.json({ approved: true }, { status: 200 });
  }

  return NextResponse.json({ error: "Domain not approved" }, { status: 404 });
}
