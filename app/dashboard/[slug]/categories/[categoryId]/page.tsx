import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getCategoryById } from "@/lib/db/queries/categories";
import { CategoryForm } from "@/components/dashboard/categories/category-form";
import { Button } from "@/components/ui/button";

interface EditCategoryPageProps {
  params: Promise<{ slug: string; categoryId: string }>;
}

export default async function EditCategoryPage({
  params,
}: EditCategoryPageProps) {
  const { slug, categoryId } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const category = await getCategoryById(store.id, categoryId);
  if (!category) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/${slug}/categories`}>
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Category</h1>
          <p className="text-muted-foreground">Update {category.name}</p>
        </div>
      </div>

      {/* Form */}
      <CategoryForm tenantId={store.id} storeSlug={slug} category={category} />
    </div>
  );
}
