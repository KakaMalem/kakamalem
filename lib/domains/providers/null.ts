import type {
  DomainProvisioner,
  ProvisionerStatus,
  RegisterOptions,
} from "../provisioner";

/**
 * No-op provisioner for local dev. Logs every call and pretends every
 * domain is happily registered with a valid cert so the rest of the
 * flow can be exercised without a Dokploy instance.
 */
export class NullProvisioner implements DomainProvisioner {
  readonly name = "null";

  async register(host: string, _options?: RegisterOptions): Promise<void> {
    console.log(`[NullProvisioner] register(${host})`);
  }

  async unregister(host: string): Promise<void> {
    console.log(`[NullProvisioner] unregister(${host})`);
  }

  async getStatus(host: string): Promise<ProvisionerStatus> {
    console.log(`[NullProvisioner] getStatus(${host})`);
    return { exists: true, certStatus: "active" };
  }

  async listRegisteredHosts(): Promise<string[]> {
    return [];
  }
}
