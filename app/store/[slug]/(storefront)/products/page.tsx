import type { Metadata } from "next";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getProducts } from "@/lib/db/queries/products";
import { getActiveCampaigns } from "@/lib/db/queries/campaigns";
import { InfiniteScrollWrapper } from "@/components/store/infinite-scroll-wrapper";

interface ProductsPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; search?: string }>;
}

export async function generateMetadata({
  params,
}: ProductsPageProps): Promise<Metadata> {
  const { slug } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) return { title: "Products Not Found" };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";
  // Canonical URL without query params to prevent duplicate content
  const productsUrl = `${baseUrl}/store/${slug}/products`;
  const description = `Browse all products at ${store.name}. Find the best deals and latest arrivals.`;

  // Get store logo for OG image
  const imageUrl = store.logoUrl ? `${baseUrl}${store.logoUrl}` : undefined;

  return {
    title: `All Products | ${store.name}`,
    description,
    // Canonical URL prevents duplicate content issues from pagination/sorting
    alternates: {
      canonical: productsUrl,
    },
    openGraph: {
      type: "website",
      title: `All Products | ${store.name}`,
      description,
      url: productsUrl,
      siteName: store.name,
      locale: "en_US",
      images: imageUrl
        ? [{ url: imageUrl, width: 1200, height: 630, alt: store.name }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `All Products | ${store.name}`,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function ProductsPage({
  params,
  searchParams,
}: ProductsPageProps) {
  const { slug } = await params;
  const { sort, search } = await searchParams;

  const store = await getTenantBySlug(slug);
  if (!store) return null;

  // Parse sorting - default to displayOrder for manual ordering
  const sortField =
    (sort?.split("-")[0] as "name" | "price" | "createdAt" | "displayOrder") ||
    "displayOrder";
  const sortDirection = (sort?.split("-")[1] as "asc" | "desc") || "asc";

  // Fetch products and active campaigns in parallel
  const [productsResult, activeCampaigns] = await Promise.all([
    getProducts(store.id, {
      page: 1,
      limit: 12,
      filters: {
        isActive: true,
        showOnStorefront: true,
        search: search || undefined,
      },
      sort: {
        field: sortField,
        direction: sortDirection,
      },
    }),
    getActiveCampaigns(store.id),
  ]);

  // Check if store is in catalog mode (no cart functionality)
  const isCatalogMode = store.storeMode === "catalog";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">All Products</h1>
        <p className="mt-2 text-muted-foreground">
          Browse our complete collection
        </p>
      </div>

      {/* Products Grid with Infinite Scroll */}
      <InfiniteScrollWrapper
        initialProducts={productsResult.products}
        initialPagination={productsResult.pagination}
        tenantId={store.id}
        storeSlug={slug}
        currency={store.currency}
        basePath={`/store/${slug}/products`}
        filters={{
          isActive: true,
          showOnStorefront: true,
          search: search || undefined,
        }}
        currentSort={sort || "displayOrder-asc"}
        catalogMode={isCatalogMode}
        activeCampaigns={activeCampaigns}
      />
    </div>
  );
}
