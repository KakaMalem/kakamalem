import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ProductSpotlightProps,
  ResolvedProduct,
} from "@/lib/page-builder/types";

interface ProductSpotlightSectionProps extends ProductSpotlightProps {
  /** Resolved product data (fetched by storefront renderer) */
  resolvedProduct?: ResolvedProduct | null;
  /** Base path for store URLs */
  basePath?: string;
  /** Store currency */
  currency?: string;
}

function formatPrice(price: string, currency: string = "AFN"): string {
  const num = parseFloat(price);
  if (isNaN(num)) return price;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function ProductSpotlightSection({
  layout = "image_left",
  showDescription: _showDescription = true,
  showPrice = true,
  ctaText = "View Product",
  backgroundColor = "",
  resolvedProduct,
  basePath = "/",
  currency = "AFN",
}: ProductSpotlightSectionProps) {
  if (!resolvedProduct) {
    return (
        <section className="py-8 px-4 sm:px-6 sm:py-12 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 py-16">
              <Sparkles className="mb-3 size-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                Product Spotlight
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Select a product to feature here
              </p>
            </div>
          </div>
        </section>
      );
    }
  }

  const product = resolvedProduct;
  const productUrl = `${basePath}/product/${product.slug}`;
  const isImageRight = layout === "image_right";

  const hasDiscount =
    product.compareAtPrice &&
    parseFloat(product.compareAtPrice) > parseFloat(product.price);

  return (
    <section
      className="py-8 px-4 sm:px-6 sm:py-12 lg:px-8"
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      <div className="mx-auto max-w-7xl">
        <div
          className={cn(
            "flex flex-col gap-6 sm:gap-8 lg:flex-row lg:items-center lg:gap-12",
            isImageRight && "lg:flex-row-reverse"
          )}
        >
          {/* Image */}
          <div className="flex-1">
            <Link href={productUrl} className="group block">
              <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.imageAlt || product.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <svg
                      className="h-16 w-16"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
                      />
                    </svg>
                  </div>
                )}
              </div>
            </Link>
          </div>

          {/* Details */}
          <div className="flex-1 flex flex-col justify-center">
            <h2 className="text-2xl font-bold sm:text-3xl lg:text-4xl">
              {product.name}
            </h2>

            {showPrice && (
              <div className="mt-3 flex items-baseline gap-3">
                <span className="text-xl font-bold sm:text-2xl">
                  {product.hasVariants && product.minVariantPrice
                    ? `From ${formatPrice(product.minVariantPrice, currency)}`
                    : formatPrice(product.price, currency)}
                </span>
                {hasDiscount && (
                  <span className="text-base text-muted-foreground line-through">
                    {formatPrice(product.compareAtPrice!, currency)}
                  </span>
                )}
              </div>
            )}

            {ctaText && (
              <div className="mt-6">
                <Link
                  href={productUrl}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:text-base"
                >
                  {ctaText}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
