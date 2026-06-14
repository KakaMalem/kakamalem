import { resolveTenant } from "@/lib/db/queries/tenants";
import { getCategoriesWithCounts } from "@/lib/db/queries/categories";
import { CategoryCard } from "@/components/store/category-card";

interface CategoriesPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CategoriesPage({ params }: CategoriesPageProps) {
  const { slug } = await params;

  const store = await resolveTenant(slug);
  if (!store) return null;

  const categories = await getCategoriesWithCounts(store.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* Page Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          All Categories
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground sm:mt-2 sm:text-base">
          Browse our collection by category
        </p>
      </div>

      {/* Categories Grid */}
      {categories.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              storeSlug={store.slug}
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
