import Image from "next/image";
import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  FeaturedCategoriesProps,
  ResolvedCategory,
} from "@/lib/page-builder/types";

interface FeaturedCategoriesSectionProps extends FeaturedCategoriesProps {
  /** Resolved category data (fetched by storefront renderer) */
  resolvedCategories?: ResolvedCategory[];
  /** Store slug for building links */
  storeSlug?: string;
  /** Base path for store URLs */
  basePath?: string;
}

const columnClasses: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
};

function CategoryCard({
  category,
  basePath,
}: {
  category: ResolvedCategory;
  basePath: string;
}) {
  return (
    <Link
      href={`${basePath}/category/${category.slug}`}
      className="group relative block overflow-hidden rounded-xl aspect-4/3"
    >
      {category.imageUrl ? (
        <Image
          src={category.imageUrl}
          alt={category.name}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
      ) : (
        <div className="absolute inset-0 bg-muted" />
      )}
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />
      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-3 sm:p-4">
        <h3 className="text-sm font-semibold text-white sm:text-base lg:text-lg">
          {category.name}
        </h3>
        {category.productCount > 0 && (
          <p className="mt-0.5 text-xs text-white/80 sm:text-sm">
            {category.productCount} product
            {category.productCount !== 1 ? "s" : ""}
          </p>
        )}
      </div>
    </Link>
  );
}

export function FeaturedCategoriesSection({
  title = "",
  layout = "grid",
  columns = 3,
  showProductCount = true,
  resolvedCategories = [],
  basePath = "/",
}: FeaturedCategoriesSectionProps) {
  if (resolvedCategories.length === 0) {
    return (
        <section className="py-8 px-4 sm:px-6 sm:py-12 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {title && (
              <h2 className="mb-6 text-xl font-bold sm:text-2xl lg:text-3xl">
                {title}
              </h2>
            )}
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 py-12">
              <LayoutGrid className="mb-3 size-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                Featured Categories
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Select categories to display here
              </p>
            </div>
          </div>
        </section>
      );
    }
  }

  const displayCategories = showProductCount
    ? resolvedCategories
    : resolvedCategories.map((c) => ({ ...c, productCount: 0 }));

  return (
    <section className="py-8 px-4 sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {title && (
          <h2 className="mb-6 text-xl font-bold sm:text-2xl lg:text-3xl">
            {title}
          </h2>
        )}

        {/* Grid Layout */}
        {layout === "grid" && (
          <div
            className={cn(
              "grid gap-3 sm:gap-4",
              columnClasses[columns] || columnClasses[3]
            )}
          >
            {displayCategories.map((cat) => (
              <CategoryCard key={cat.id} category={cat} basePath={basePath} />
            ))}
          </div>
        )}

        {/* Horizontal Scroll Layout */}
        {layout === "scroll" && (
          <div className="flex gap-3 overflow-x-auto pb-4 sm:gap-4 snap-x snap-mandatory scrollbar-none">
            {displayCategories.map((cat) => (
              <div
                key={cat.id}
                className="w-50 shrink-0 snap-start sm:w-60 lg:w-70"
              >
                <CategoryCard category={cat} basePath={basePath} />
              </div>
            ))}
          </div>
        )}

        {/* Bento Layout: 1 large + rest small */}
        {layout === "bento" && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {displayCategories.map((cat, i) => (
              <div
                key={cat.id}
                className={cn(i === 0 && "col-span-2 row-span-2 lg:col-span-1")}
              >
                <CategoryCard category={cat} basePath={basePath} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
