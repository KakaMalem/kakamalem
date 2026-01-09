import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";

import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getCategoryBySlugWithImage } from "@/lib/db/queries/categories";
import { getProducts } from "@/lib/db/queries/products";
import { ProductGridWrapper } from "@/components/store/product-grid-wrapper";

interface CategoryPageProps {
  params: Promise<{ slug: string; categorySlug: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug, categorySlug } = await params;
  const store = await getTenantBySlug(slug);
  if (!store) return { title: "Category Not Found" };

  const category = await getCategoryBySlugWithImage(store.id, categorySlug);
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
  const { page, sort } = await searchParams;

  const store = await getTenantBySlug(slug);
  if (!store) return null;

  const category = await getCategoryBySlugWithImage(store.id, categorySlug);
  if (!category) {
    notFound();
  }

  // Parse pagination and sorting
  const currentPage = parseInt(page || "1", 10);
  const sortField =
    (sort?.split("-")[0] as "name" | "price" | "createdAt") || "createdAt";
  const sortDirection = (sort?.split("-")[1] as "asc" | "desc") || "desc";

  const productsResult = await getProducts(store.id, {
    page: currentPage,
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

        {/* Products Grid */}
        <ProductGridWrapper
          products={productsResult.products}
          pagination={productsResult.pagination}
          tenantId={store.id}
          storeSlug={slug}
          currency={store.currency}
          basePath={`/store/${slug}/category/${categorySlug}`}
          currentSort={sort}
        />
      </div>
    </div>
  );
}
