/**
 * Domain Provisioner
 *
 * Abstracts the upstream proxy that owns TLS termination and routing for
 * tenant custom domains. In production we use Dokploy + Traefik; in local
 * dev we use a no-op implementation.
 *
 * Keeping registration behind this interface means we can swap out the
 * infrastructure (Caddy on-demand TLS, Cloudflare for SaaS, etc.) without
 * touching the verification flow.
 */

export interface ProvisionerStatus {
  /** Whether the domain is registered with the upstream proxy at all. */
  exists: boolean;
  /** Cert state, as best we can infer from the upstream. */
  certStatus: "active" | "provisioning" | "error" | "unknown";
  /** Provider-specific identifier (e.g. Dokploy's domainId). Useful for delete/update calls. */
  externalId?: string;
  /** Human-readable error, when `certStatus === "error"`. */
  error?: string;
}

export interface RegisterOptions {
  /** Defaults to true. */
  https?: boolean;
  /** Defaults to "letsencrypt". */
  certificateType?: "letsencrypt" | "none" | "custom";
}

export interface DomainProvisioner {
  /** Name of the implementation, for logs. */
  readonly name: string;

  /**
   * Register a hostname with the upstream proxy. Should be idempotent —
   * if the domain is already registered, return success without error.
   */
  register(host: string, options?: RegisterOptions): Promise<void>;

  /**
   * Remove a hostname from the upstream proxy. Should tolerate
   * "already gone" by returning success.
   */
  unregister(host: string): Promise<void>;

  /**
   * Check whether the upstream knows about this domain and what state
   * its cert is in. Used by the reconcile cron to detect drift.
   */
  getStatus(host: string): Promise<ProvisionerStatus>;

  /** Returns every host currently registered. Used by reconcile to find orphans. */
  listRegisteredHosts(): Promise<string[]>;
}

/**
 * Thrown when a provisioner can't reach the upstream or gets a non-2xx
 * response. Callers should catch and surface a meaningful message to
 * the user (e.g. via the `domainError` field on tenants).
 */
export class ProvisionerError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly status?: number
  ) {
    super(message);
    this.name = "ProvisionerError";
  }
}
