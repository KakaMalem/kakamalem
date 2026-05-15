import {
  ProvisionerError,
  type DomainProvisioner,
  type ProvisionerStatus,
  type RegisterOptions,
} from "../provisioner";

/**
 * Dokploy domain provisioner.
 *
 * Dokploy exposes its tRPC routers as REST under /api/* with an x-api-key
 * header. The routes we care about are domain.create, domain.delete,
 * domain.byApplicationId, and domain.update. Authoritative spec lives in
 * the Dokploy repo under apps/dokploy/server/api/routers/domain.ts.
 */

interface DokployConfig {
  apiUrl: string;
  apiKey: string;
  applicationId: string;
}

interface DokployDomainRecord {
  domainId: string;
  host: string;
  https: boolean | null;
  certificateType: string | null;
  port: number | null;
  path: string | null;
}

export class DokployProvisioner implements DomainProvisioner {
  readonly name = "dokploy";
  private readonly config: DokployConfig;

  constructor(config: DokployConfig) {
    this.config = config;
  }

  async register(host: string, options: RegisterOptions = {}): Promise<void> {
    // Idempotent: if Dokploy already has it, succeed.
    const existing = await this.findByHost(host);
    if (existing) return;

    await this.call("domain.create", "POST", {
      host,
      applicationId: this.config.applicationId,
      path: "/",
      port: 3000,
      https: options.https ?? true,
      certificateType: options.certificateType ?? "letsencrypt",
    });
  }

  async unregister(host: string): Promise<void> {
    const existing = await this.findByHost(host);
    if (!existing) return; // already gone
    await this.call("domain.delete", "POST", { domainId: existing.domainId });
  }

  async getStatus(host: string): Promise<ProvisionerStatus> {
    const existing = await this.findByHost(host);
    if (!existing) {
      return { exists: false, certStatus: "unknown" };
    }
    return {
      exists: true,
      externalId: existing.domainId,
      // Dokploy doesn't surface cert state on the domain record itself;
      // the actual cert health comes from probing HTTPS (see the
      // domain-health cron). Mark active if HTTPS is enabled, otherwise
      // unknown.
      certStatus: existing.https ? "active" : "unknown",
    };
  }

  async listRegisteredHosts(): Promise<string[]> {
    const records = await this.listForApplication();
    return records.map((r) => r.host);
  }

  // ---------- internals ----------

  private async findByHost(host: string): Promise<DokployDomainRecord | null> {
    const all = await this.listForApplication();
    return all.find((d) => d.host.toLowerCase() === host.toLowerCase()) ?? null;
  }

  private async listForApplication(): Promise<DokployDomainRecord[]> {
    const data = await this.call<DokployDomainRecord[]>(
      "domain.byApplicationId",
      "GET",
      undefined,
      { applicationId: this.config.applicationId }
    );
    return Array.isArray(data) ? data : [];
  }

  private async call<T = unknown>(
    procedure: string,
    method: "GET" | "POST",
    body?: unknown,
    query?: Record<string, string>
  ): Promise<T> {
    const url = new URL(`/api/${procedure}`, this.config.apiUrl);
    if (query) {
      for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          "x-api-key": this.config.apiKey,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
    } catch (cause) {
      throw new ProvisionerError(
        `Dokploy unreachable while calling ${procedure}`,
        cause
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new ProvisionerError(
        `Dokploy ${procedure} failed (${response.status}): ${text || response.statusText}`,
        undefined,
        response.status
      );
    }

    // Some endpoints return empty bodies on success.
    const raw = await response.text();
    if (!raw) return undefined as T;
    try {
      return JSON.parse(raw) as T;
    } catch (cause) {
      throw new ProvisionerError(
        `Dokploy ${procedure} returned non-JSON: ${raw.slice(0, 200)}`,
        cause
      );
    }
  }
}
