import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import {
  getProducts,
  getProductCounts,
  getTenantCategories,
} from "@/lib/db/queries/products";
import { ProductsList } from "@/components/dashboard/products/products-list";
import { ProductsHeader } from "@/components/dashboard/products/products-header";
import { ProductsFilters } from "@/components/dashboard/products/products-filters";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";

interface ProductsPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    page?: string;
    search?: string;
    category?: string;
    status?: string;
    stock?: string;
    sort?: string;
    order?: string;
  }>;
}

export default async function ProductsPage({
  params,
  searchParams,
}: ProductsPageProps) {
  const { slug } = await params;
  const search = await searchParams;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  // Parse search params
  const page = parseInt(search.page || "1");
  const filters = {
    search: search.search,
    categoryId: search.category,
    isActive:
      search.status === "active"
        ? true
        : search.status === "draft"
        ? false
        : undefined,
    stockStatus: search.stock as
      | "in_stock"
      | "low_stock"
      | "out_of_stock"
      | undefined,
  };
  const sort = search.sort
    ? {
        field: search.sort as
          | "name"
          | "price"
          | "stock"
          | "createdAt"
          | "displayOrder",
        direction: (search.order || "desc") as "asc" | "desc",
      }
    : undefined;

  // Fetch data in parallel
  const [{ products, pagination }, counts, categories] = await Promise.all([
    getProducts(store.id, { page, limit: 10, filters, sort }),
    getProductCounts(store.id),
    getTenantCategories(store.id),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">
            Manage your store&apos;s products and inventory.
          </p>
        </div>
        <Button asChild>
          <Link href={`/dashboard/${slug}/products/new`}>
            <Plus className="size-4" />
            Add Product
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <ProductsHeader counts={counts} />

      {/* Filters */}
      <ProductsFilters
        categories={categories}
        currentFilters={filters}
        currentSort={sort}
        storeSlug={slug}
      />

      {/* Products List */}
      <ProductsList
        products={products}
        storeSlug={slug}
        currency={store.currency}
        tenantId={store.id}
      />

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page === 1}
            asChild={pagination.page > 1}
          >
            {pagination.page > 1 ? (
              <Link
                href={`/dashboard/${slug}/products?page=${pagination.page - 1}${
                  search.search ? `&search=${search.search}` : ""
                }${search.category ? `&category=${search.category}` : ""}${
                  search.status ? `&status=${search.status}` : ""
                }${search.stock ? `&stock=${search.stock}` : ""}${
                  search.sort ? `&sort=${search.sort}` : ""
                }${search.order ? `&order=${search.order}` : ""}`}
              >
                <ChevronLeft className="size-4" />
                Previous
              </Link>
            ) : (
              <>
                <ChevronLeft className="size-4" />
                Previous
              </>
            )}
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page === pagination.totalPages}
            asChild={pagination.page < pagination.totalPages}
          >
            {pagination.page < pagination.totalPages ? (
              <Link
                href={`/dashboard/${slug}/products?page=${pagination.page + 1}${
                  search.search ? `&search=${search.search}` : ""
                }${search.category ? `&category=${search.category}` : ""}${
                  search.status ? `&status=${search.status}` : ""
                }${search.stock ? `&stock=${search.stock}` : ""}${
                  search.sort ? `&sort=${search.sort}` : ""
                }${search.order ? `&order=${search.order}` : ""}`}
              >
                Next
                <ChevronRight className="size-4" />
              </Link>
            ) : (
              <>
                Next
                <ChevronRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
