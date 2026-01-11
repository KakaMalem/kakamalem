import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";

import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getCategoryBySlugWithImage } from "@/lib/db/queries/categories";
import { getProducts } from "@/lib/db/queries/products";
import { InfiniteScrollWrapper } from "@/components/store/infinite-scroll-wrapper";

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

  const store = await getTenantBySlug(slug);
  if (!store) return { title: "Category Not Found" };

  const category = await getCategoryBySlugWithImage(
    store.id,
    decodedCategorySlug
  );
  if (!category) return { title: "Category Not Found" };

  return {
    title: `${category.name} | ${store.name}`,
    description:
      category.description ||
      `Browse ${category.name} products at ${store.name}`,
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

  const store = await getTenantBySlug(slug);
  if (!store) return null;

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

  const productsResult = await getProducts(store.id, {
    page: 1,
    limit: 12,
    filters: {
      categoryId: category.id,
      isActive: true,
    },
    sort: {
      field: sortField,
      direction: sortDirection,
    },
  });

  return (
    <div className="flex flex-col">
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/store/${slug}`} className="hover:text-foreground">
            Home
          </Link>
          <ChevronRight className="size-4" />
          <span className="text-foreground">{category.name}</span>
        </nav>

        {/* Products Grid with Infinite Scroll */}
        <InfiniteScrollWrapper
          initialProducts={productsResult.products}
          initialPagination={productsResult.pagination}
          tenantId={store.id}
          storeSlug={slug}
          currency={store.currency}
          basePath={`/store/${slug}/category/${categorySlug}`}
          filters={{
            categoryId: category.id,
            isActive: true,
          }}
          currentSort={sort || "createdAt-desc"}
        />
      </div>
    </div>
  );
}
