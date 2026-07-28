import Link from "next/link";
import { ArrowRight, LayoutGrid } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CategoryCard, type CategoryCardData } from "./category-card";

interface CategoryShowcaseProps {
  categories: CategoryCardData[];
  /**
   * "page" is the standalone /categories route — it owns the <h1>.
   * "home" is the storefront homepage, where the store name is already the
   * <h1>, so this renders as a titled section instead.
   */
  variant: "page" | "home";
  /** Store base path — "" on custom domains, "/store/[slug]" otherwise */
  basePath: string;
}

/**
 * Decide which cards get the wide "feature" treatment.
 *
 * The pattern repeats every 7 cards, which tiles without holes at both grid
 * widths: at 4 columns a feature(2) + two standards fill a row, then four
 * standards fill the next; at 2 columns the feature owns a row and the six
 * standards fill three more. Changing the column ladder breaks this — keep it
 * at grid-cols-2 / md:grid-cols-4.
 */
function isFeature(index: number, total: number, hasProducts: boolean) {
  // With one or two cards there is nothing to tile against — going wide beats
  // leaving half the row empty, even for a category with no products yet.
  if (total <= 2) return true;
  if (!hasProducts) return false; // otherwise never headline an empty category
  return index % 7 === 0;
}

export function CategoryShowcase({
  categories,
  variant,
  basePath,
}: CategoryShowcaseProps) {
  const storeHome = basePath || "/";

  if (categories.length === 0) {
    // The homepage still has its product grid below, so an empty-state block
    // there would just be noise — only the standalone page needs one.
    if (variant === "home") return null;

    return (
      <div className="flex flex-col items-center justify-center py-16 text-center sm:py-24">
        <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-muted/50">
          <LayoutGrid className="size-10 text-muted-foreground/50" />
        </div>
        <h2 className="text-xl font-semibold">No categories yet</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          This store hasn&apos;t grouped its products into collections yet.
        </p>
        <Button variant="outline" className="mt-6" asChild>
          <Link href={`${basePath}/products`}>Browse all products</Link>
        </Button>
      </div>
    );
  }

  // Categories with stock lead; empty ones sink to the bottom rather than
  // disappearing, so sellers can still see them on their own storefront.
  const ordered = [
    ...categories.filter((c) => c.productCount > 0),
    ...categories.filter((c) => c.productCount === 0),
  ];

  const totalProducts = categories.reduce((sum, c) => sum + c.productCount, 0);
  const single = ordered.length === 1;

  return (
    <section aria-labelledby="category-showcase-heading">
      {variant === "page" ? (
        <>
          <nav
            aria-label="Breadcrumb"
            className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Link
              href={storeHome}
              className="transition-colors hover:text-foreground"
            >
              Home
            </Link>
            <span aria-hidden>/</span>
            <span className="text-foreground">Categories</span>
          </nav>
          <div className="mb-6 sm:mb-8">
            <h1
              id="category-showcase-heading"
              className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl"
            >
              Shop by Category
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground sm:mt-2 sm:text-base">
              {categories.length}{" "}
              {categories.length === 1 ? "collection" : "collections"}
              {totalProducts > 0 && (
                <>
                  {" · "}
                  {totalProducts} {totalProducts === 1 ? "product" : "products"}
                </>
              )}
            </p>
          </div>
        </>
      ) : (
        <div className="mb-4 flex items-end justify-between gap-4 sm:mb-6">
          <h2
            id="category-showcase-heading"
            className="text-xl font-bold tracking-tight sm:text-2xl"
          >
            Shop by Category
          </h2>
          <Link
            href={`${basePath}/categories`}
            className="group inline-flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            View all
            <ArrowRight
              aria-hidden
              className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transform-none"
            />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {ordered.map((category, index) => (
          <CategoryCard
            key={category.id}
            category={category}
            variant={
              isFeature(index, ordered.length, category.productCount > 0)
                ? "feature"
                : "standard"
            }
            // The first cover is above the fold on both surfaces and is
            // usually the LCP element; without this it lazy-loads.
            priority={index === 0}
            className={single ? "md:col-span-4" : undefined}
          />
        ))}
      </div>
    </section>
  );
}
