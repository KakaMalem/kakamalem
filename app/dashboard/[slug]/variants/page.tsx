import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getTenantVariantOptions } from "@/lib/db/queries/variants";
import { VariantOptionsManager } from "@/components/dashboard/variants/variant-options-manager";

interface VariantsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function VariantsPage({ params }: VariantsPageProps) {
  const { slug } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const variantOptions = await getTenantVariantOptions(store.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Variant Options</h1>
        <p className="text-muted-foreground">
          Manage variant options like Size, Color, Material that can be used
          across your products.
        </p>
      </div>

      {/* Variant Options Manager */}
      <VariantOptionsManager
        tenantId={store.id}
        variantOptions={variantOptions}
      />
    </div>
  );
}
