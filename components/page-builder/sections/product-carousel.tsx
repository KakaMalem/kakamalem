"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";
import type {
  ProductCarouselProps,
  ResolvedProduct,
} from "@/lib/page-builder/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Resolve store-relative links: /products → basePath/products */
function resolveLink(link: string, basePath: string): string {
  if (!link || !basePath) return link;
  if (link.startsWith("/") && !link.startsWith("//")) {
    return `${basePath}${link}`;
  }
  return link;
}

// ---------------------------------------------------------------------------
// Responsive basis classes per slidesPerView setting
// ---------------------------------------------------------------------------

const basisClasses: Record<string, string> = {
  "2": "basis-[80%] md:basis-1/2",
  "3": "basis-[80%] md:basis-1/2 lg:basis-1/3",
  "4": "basis-[80%] md:basis-1/3 lg:basis-1/4",
};

// ---------------------------------------------------------------------------
// Inline Product Card
// ---------------------------------------------------------------------------

interface ProductCardInlineProps {
  product: ResolvedProduct;
  basePath: string;
  currency: string;
  cardStyle: ProductCarouselProps["cardStyle"];
}

function ProductCardInline({
  product,
  basePath,
  currency,
  cardStyle,
}: ProductCardInlineProps) {
  const hasDiscount =
    product.compareAtPrice &&
    parseFloat(product.compareAtPrice) > parseFloat(product.price);

  const priceDisplay =
    product.hasVariants && product.minVariantPrice
      ? `From ${formatPrice(product.minVariantPrice, currency)}`
      : formatPrice(product.price, currency);

  const href = `${basePath}/product/${product.slug}`;

  return (
    <Link href={href} className="group block">
      {/* Image container */}
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted">
        {product.imageUrl ? (
          <>
            <Image
              src={product.imageUrl}
              alt={product.imageAlt || product.name}
              fill
              className={cn(
                "object-cover transition-all duration-500",
                product.secondImageUrl
                  ? "group-hover:opacity-0"
                  : "group-hover:scale-105"
              )}
              sizes="(max-width: 640px) 80vw, (max-width: 1024px) 50vw, 33vw"
            />
            {/* Second image on hover */}
            {product.secondImageUrl && (
              <Image
                src={product.secondImageUrl}
                alt={product.imageAlt || product.name}
                fill
                className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                sizes="(max-width: 640px) 80vw, (max-width: 1024px) 50vw, 33vw"
              />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ShoppingBag className="h-10 w-10" />
          </div>
        )}

        {/* Sale badge */}
        {hasDiscount && (
          <div className="absolute top-2 left-2 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            Sale
          </div>
        )}
      </div>

      {/* Product info */}
      <div className={cn("mt-3", cardStyle === "compact" && "mt-2")}>
        <h3
          className={cn(
            "font-medium line-clamp-2",
            cardStyle === "minimal"
              ? "text-xs"
              : cardStyle === "compact"
                ? "text-xs sm:text-sm"
                : "text-sm sm:text-base"
          )}
        >
          {product.name}
        </h3>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={cn(
              "font-semibold",
              cardStyle === "minimal" ? "text-xs" : "text-sm"
            )}
          >
            {priceDisplay}
          </span>
          {hasDiscount && (
            <span
              className={cn(
                "text-muted-foreground line-through",
                cardStyle === "minimal" ? "text-[10px]" : "text-xs"
              )}
            >
              {formatPrice(product.compareAtPrice!, currency)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// ProductCarousel Section
// ---------------------------------------------------------------------------

interface ProductCarouselSectionProps extends ProductCarouselProps {
  resolvedProducts?: ResolvedProduct[];
  basePath?: string;
  currency?: string;
}

export function ProductCarouselSection({
  heading = "",
  subtitle = "",
  showViewAll = false,
  viewAllUrl = "",
  slidesPerView = "4",
  showArrows = true,
  cardStyle = "standard",
  backgroundColor = "",
  textColor = "dark",
  resolvedProducts = [],
  basePath = "/",
  currency = "AFN",
}: ProductCarouselSectionProps) {
  const isDark = textColor === "light";

  // Empty state — editor placeholder
  if (!resolvedProducts || resolvedProducts.length === 0) {
    return (
        <section
          className="py-8 px-4 sm:px-6 sm:py-12 lg:px-8"
          style={backgroundColor ? { backgroundColor } : undefined}
        >
          <div className="mx-auto max-w-7xl">
            {heading && (
              <h2
                className={cn(
                  "mb-6 text-xl font-bold sm:text-2xl lg:text-3xl",
                  isDark && "text-white"
                )}
              >
                {heading}
              </h2>
            )}
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 py-12">
              <ShoppingBag className="mb-3 size-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                Product Carousel
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Configure a product source to see products here
              </p>
            </div>
          </div>
        </section>
      );
    }
  }

  const resolvedViewAllUrl = viewAllUrl
    ? resolveLink(viewAllUrl, basePath)
    : `${basePath}/products`;

  return (
    <section
      className="py-8 px-4 sm:px-6 sm:py-12 lg:px-8"
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        {(heading || subtitle || showViewAll) && (
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              {subtitle && (
                <p
                  className={cn(
                    "mb-1 text-[11px] font-semibold uppercase tracking-[0.15em]",
                    isDark ? "text-white/60" : "text-muted-foreground"
                  )}
                >
                  {subtitle}
                </p>
              )}
              {heading && (
                <h2
                  className={cn(
                    "text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl",
                    isDark && "text-white"
                  )}
                >
                  {heading}
                </h2>
              )}
            </div>
            {showViewAll && (
              <Link
                href={resolvedViewAllUrl}
                className={cn(
                  "group flex shrink-0 items-center gap-1 text-sm font-medium transition-colors",
                  isDark
                    ? "text-white/80 hover:text-white"
                    : "text-foreground/70 hover:text-foreground"
                )}
              >
                View all
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>
        )}

        {/* Carousel */}
        <Carousel opts={{ align: "start", loop: false }} className="w-full">
          <CarouselContent className="-ml-3 sm:-ml-4">
            {resolvedProducts.map((product) => (
              <CarouselItem
                key={product.id}
                className={cn(
                  "pl-3 sm:pl-4",
                  basisClasses[slidesPerView] || basisClasses["4"]
                )}
              >
                <ProductCardInline
                  product={product}
                  basePath={basePath}
                  currency={currency}
                  cardStyle={cardStyle}
                />
              </CarouselItem>
            ))}
          </CarouselContent>

          {showArrows && resolvedProducts.length > parseInt(slidesPerView) && (
            <>
              <CarouselPrevious
                className={cn(
                  "hidden sm:inline-flex",
                  "left-0 -translate-x-1/2 border-0 bg-background/90 shadow-md backdrop-blur-sm hover:bg-background",
                  isDark && "bg-white/10 text-white hover:bg-white/20"
                )}
              />
              <CarouselNext
                className={cn(
                  "hidden sm:inline-flex",
                  "right-0 translate-x-1/2 border-0 bg-background/90 shadow-md backdrop-blur-sm hover:bg-background",
                  isDark && "bg-white/10 text-white hover:bg-white/20"
                )}
              />
            </>
          )}
        </Carousel>
      </div>
    </section>
  );
}
