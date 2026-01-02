import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getCategoriesWithCounts } from "@/lib/db/queries/categories";
import { CategoriesList } from "@/components/dashboard/categories/categories-list";
import { Button } from "@/components/ui/button";

interface CategoriesPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CategoriesPage({ params }: CategoriesPageProps) {
  const { slug } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const categories = await getCategoriesWithCounts(store.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground">
            Organize your products into categories. Drag to reorder.
          </p>
        </div>
        <Button asChild>
          <Link href={`/dashboard/${slug}/categories/new`}>
            <Plus className="size-4" />
            Add Category
          </Link>
        </Button>
      </div>

      {/* Categories List */}
      <CategoriesList
        tenantId={store.id}
        storeSlug={slug}
        categories={categories}
      />
    </div>
  );
}
