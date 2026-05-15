import { DokployProvisioner } from "./providers/dokploy";
import { NullProvisioner } from "./providers/null";
import type { DomainProvisioner } from "./provisioner";

export { ProvisionerError } from "./provisioner";
export type {
  DomainProvisioner,
  ProvisionerStatus,
  RegisterOptions,
} from "./provisioner";

let cachedProvisioner: DomainProvisioner | null = null;

/**
 * Returns the configured domain provisioner. Reads env on first call and
 * caches the result for the lifetime of the process.
 *
 * - `DOMAIN_PROVISIONER=dokploy` → uses Dokploy's REST API. Requires
 *   `DOKPLOY_API_URL`, `DOKPLOY_API_KEY`, `DOKPLOY_APPLICATION_ID`.
 * - `DOMAIN_PROVISIONER=null` (or unset) → no-op for local dev/tests.
 *
 * If `dokploy` is requested but configuration is missing we fall back
 * to the null provisioner and log a warning, so a half-configured dev
 * environment doesn't crash request paths.
 */
export function getDomainProvisioner(): DomainProvisioner {
  if (cachedProvisioner) return cachedProvisioner;

  const kind = (process.env.DOMAIN_PROVISIONER ?? "null").toLowerCase();

  if (kind === "dokploy") {
    const apiUrl = process.env.DOKPLOY_API_URL;
    const apiKey = process.env.DOKPLOY_API_KEY;
    const applicationId = process.env.DOKPLOY_APPLICATION_ID;
    if (apiUrl && apiKey && applicationId) {
      cachedProvisioner = new DokployProvisioner({
        apiUrl,
        apiKey,
        applicationId,
      });
      return cachedProvisioner;
    }
    console.warn(
      "[domains] DOMAIN_PROVISIONER=dokploy but DOKPLOY_API_URL / DOKPLOY_API_KEY / DOKPLOY_APPLICATION_ID is missing — falling back to null provisioner."
    );
  }

  cachedProvisioner = new NullProvisioner();
  return cachedProvisioner;
}

/** Test/seed only — clears the cached singleton. */
export function __resetDomainProvisionerForTests(): void {
  cachedProvisioner = null;
}
