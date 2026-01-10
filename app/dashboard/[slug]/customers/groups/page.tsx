import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getTenantCustomerGroups } from "@/lib/db/queries/pricing";
import { CustomerGroupsClient } from "./client";

interface CustomerGroupsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CustomerGroupsPage({
  params,
}: CustomerGroupsPageProps) {
  const { slug } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const groups = await getTenantCustomerGroups(store.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customer Groups</h1>
        <p className="text-muted-foreground">
          Create customer groups to offer targeted pricing for different
          customer segments.
        </p>
      </div>

      <CustomerGroupsClient tenantId={store.id} groups={groups} />
    </div>
  );
}
