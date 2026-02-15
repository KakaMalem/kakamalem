import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";

import { resolveTenant } from "@/lib/db/queries/tenants";
import { getStoreBasePath, getStoreBaseUrl } from "@/lib/utils/store-path";
import { getCategoryBySlugWithImage } from "@/lib/db/queries/categories";
import { getProducts } from "@/lib/db/queries/products";
import { getActiveCampaigns } from "@/lib/db/queries/campaigns";
import { InfiniteScrollWrapper } from "@/components/store/infinite-scroll-wrapper";
import { BreadcrumbStructuredData } from "@/components/store/breadcrumb-structured-data";
import {
  CategoryStructuredData,
  CollectionPageStructuredData,
} from "@/components/store/category-structured-data";

interface CategoryPageProps {
  params: Promise<{ slug: string; categorySlug: string }>;
  searchParams: Promise<{ sort?: string }>;
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug, categorySlug } = await params;
  // Decode URL-encoded slugs (handles Persian/Unicode characters)
  const decodedCategorySlug = decodeURIComponent(categorySlug);

  const store = await resolveTenant(slug);
  if (!store) return { title: "Category Not Found" };

  const category = await getCategoryBySlugWithImage(
    store.id,
    decodedCategorySlug
  );
  if (!category) return { title: "Category Not Found" };

  const storeBaseUrl = await getStoreBaseUrl(store.slug);
  const categoryUrl = `${storeBaseUrl}/category/${categorySlug}`;
  const description =
    category.description || `Browse ${category.name} products at ${store.name}`;

  // Get category image for OG (use app URL for asset paths)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";
  const imageUrl = category.image?.url
    ? `${appUrl}${category.image.url}`
    : undefined;

  return {
    title: `${category.name} | ${store.name}`,
    description,
    // Canonical URL prevents duplicate content issues
    alternates: {
      canonical: categoryUrl,
    },
    openGraph: {
      type: "website",
      title: `${category.name} | ${store.name}`,
      description,
      url: categoryUrl,
      siteName: store.name,
      locale: "en_US",
      images: imageUrl
        ? [{ url: imageUrl, width: 1200, height: 630, alt: category.name }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${category.name} | ${store.name}`,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { slug, categorySlug } = await params;
  const { sort } = await searchParams;
  // Decode URL-encoded slugs (handles Persian/Unicode characters)
  const decodedCategorySlug = decodeURIComponent(categorySlug);

  const store = await resolveTenant(slug);
  if (!store) return null;

  const basePath = await getStoreBasePath(store.slug);
  const storeBaseUrl = await getStoreBaseUrl(store.slug);

  const category = await getCategoryBySlugWithImage(
    store.id,
    decodedCategorySlug
  );
  if (!category) {
    notFound();
  }

  // Parse sorting
  const sortField =
    (sort?.split("-")[0] as "name" | "price" | "createdAt") || "createdAt";
  const sortDirection = (sort?.split("-")[1] as "asc" | "desc") || "desc";

  // Fetch products and active campaigns in parallel
  const [productsResult, activeCampaigns] = await Promise.all([
    getProducts(store.id, {
      page: 1,
      limit: 12,
      filters: {
        categoryId: category.id,
        isActive: true,
        showOnStorefront: true,
      },
      sort: {
        field: sortField,
        direction: sortDirection,
      },
    }),
    getActiveCampaigns(store.id),
  ]);

  // Check if online cart should be disabled
  // - catalog: Display only, no checkout anywhere
  // - offline_only: POS only, no online checkout
  const isCartDisabled =
    store.storeMode === "catalog" || store.storeMode === "offline_only";

  // Build breadcrumbs for structured data
  const breadcrumbs = [
    { label: "Home", href: basePath || "/" },
    { label: category.name, href: "#", current: true },
  ];

  // Build category URL for structured data
  const categoryUrl = `${storeBaseUrl}/category/${decodedCategorySlug}`;

  return (
    <>
      {/* SEO: Breadcrumb structured data */}
      <BreadcrumbStructuredData breadcrumbs={breadcrumbs} />

      {/* SEO: ItemList structured data for product carousel */}
      <CategoryStructuredData
        categoryName={category.name}
        categoryDescription={category.description}
        storeSlug={store.slug}
        products={productsResult.products.map((p) => ({
          slug: p.slug,
          name: p.name,
        }))}
      />

      {/* SEO: CollectionPage structured data */}
      <CollectionPageStructuredData
        categoryName={category.name}
        categoryDescription={category.description}
        categoryUrl={categoryUrl}
        storeName={store.name}
        imageUrl={category.image?.url}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={basePath || "/"} className="hover:text-foreground">
            Home
          </Link>
          <ChevronRight className="size-4" />
          <span className="text-foreground">{category.name}</span>
        </nav>

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{category.name}</h1>
          {category.description && (
            <p className="mt-2 text-muted-foreground">{category.description}</p>
          )}
        </div>

        {/* Products Grid with Infinite Scroll */}
        <InfiniteScrollWrapper
          initialProducts={productsResult.products}
          initialPagination={productsResult.pagination}
          tenantId={store.id}
          storeSlug={store.slug}
          currency={store.currency}
          basePath={`${basePath}/category/${categorySlug}`}
          filters={{
            categoryId: category.id,
            isActive: true,
            showOnStorefront: true,
          }}
          currentSort={sort || "createdAt-desc"}
          catalogMode={isCartDisabled}
          activeCampaigns={activeCampaigns}
        />
      </div>
    </>
  );
}
