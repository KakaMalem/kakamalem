import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { resolveTenant } from "@/lib/db/queries/tenants";
import {
  getCategoriesWithCounts,
  getCategoryCoverFallbacks,
} from "@/lib/db/queries/categories";
import { getStoreBasePath, getStoreBaseUrl } from "@/lib/utils/store-path";
import { CategoryShowcase } from "@/components/store/category-showcase";

interface CategoriesPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: CategoriesPageProps): Promise<Metadata> {
  const { slug } = await params;
  const store = await resolveTenant(slug);

  if (!store) {
    return { title: "Categories Not Found" };
  }

  const storeBaseUrl = await getStoreBaseUrl(store.slug);
  const title = `Shop by Category | ${store.name}`;
  const description = `Browse every collection at ${store.name}.`;

  return {
    title,
    description,
    // Without this the page inherits the layout's canonical, which points at
    // the store homepage — and that homepage may now show categories too.
    alternates: { canonical: `${storeBaseUrl}/categories` },
    openGraph: {
      type: "website",
      title,
      description,
      url: `${storeBaseUrl}/categories`,
      siteName: store.name,
    },
  };
}

export default async function CategoriesPage({ params }: CategoriesPageProps) {
  const { slug } = await params;

  const store = await resolveTenant(slug);
  if (!store) notFound();

  const [categories, covers, basePath] = await Promise.all([
    getCategoriesWithCounts(store.id, { storefrontOnly: true }),
    getCategoryCoverFallbacks(store.id),
    getStoreBasePath(store.slug),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <CategoryShowcase
        variant="page"
        basePath={basePath}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          imageUrl: c.imageUrl,
          productCount: c.productCount,
          coverImageUrl: covers.get(c.id) ?? null,
        }))}
      />
    </div>
  );
}
