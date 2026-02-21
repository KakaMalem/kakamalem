import { notFound } from "next/navigation";
import { resolveTenant } from "@/lib/db/queries/tenants";
import { getPublishedPageLayoutBySlug } from "@/lib/db/queries/page-layouts";
import { getStoreBasePath } from "@/lib/utils/store-path";
import { StorefrontRenderer } from "@/components/page-builder/storefront-renderer";

interface PageProps {
  params: Promise<{ slug: string; pageSlug: string }>;
}

export default async function StorefrontPage({ params }: PageProps) {
  const { slug, pageSlug } = await params;

  const store = await resolveTenant(slug);
  if (!store) return null;

  const isCartDisabled =
    store.storeMode === "catalog" || store.storeMode === "offline_only";

  const publishedLayout = await getPublishedPageLayoutBySlug(
    store.id,
    pageSlug
  );

  if (!publishedLayout) {
    notFound();
  }

  const basePath = await getStoreBasePath(store.slug);

  return (
    <StorefrontRenderer
      data={publishedLayout}
      context={{
        tenantId: store.id,
        storeSlug: store.slug,
        currency: store.currency,
        catalogMode: isCartDisabled,
        basePath,
      }}
    />
  );
}
