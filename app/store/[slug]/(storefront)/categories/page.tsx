import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getCategoriesWithCounts } from "@/lib/db/queries/categories";
import { CategoryCard } from "@/components/store/category-card";

interface CategoriesPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CategoriesPage({ params }: CategoriesPageProps) {
  const { slug } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) return null;

  const categories = await getCategoriesWithCounts(store.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">All Categories</h1>
        <p className="mt-2 text-muted-foreground">
          Browse our collection by category
        </p>
      </div>

      {/* Categories Grid */}
      {categories.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              storeSlug={slug}
            />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center">
          <h2 className="text-xl font-semibold text-muted-foreground">
            No categories yet
          </h2>
          <p className="mt-2 text-muted-foreground">
            Check back soon for new categories!
          </p>
        </div>
      )}
    </div>
  );
}
