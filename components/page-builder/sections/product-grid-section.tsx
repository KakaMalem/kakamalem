import Image from "next/image";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ProductGridProps,
  ResolvedProduct,
} from "@/lib/page-builder/types";

interface ProductGridSectionProps extends ProductGridProps {
  resolvedProducts?: ResolvedProduct[];
  storeSlug?: string;
  basePath?: string;
  currency?: string;
}

const columnClasses: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
};

const aspectRatioClasses: Record<string, string> = {
  square: "aspect-square",
  portrait: "aspect-[3/4]",
  landscape: "aspect-[4/3]",
};

const borderRadiusMap: Record<string, string> = {
  none: "rounded-none",
  sm: "rounded",
  md: "rounded-lg",
  lg: "rounded-xl",
};

const shadowMap: Record<string, string> = {
  none: "",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
};

const hoverEffectMap: Record<string, string> = {
  none: "",
  lift: "hover:-translate-y-1 hover:shadow-lg transition-all duration-300",
  scale: "hover:scale-[1.02] transition-transform duration-300",
  glow: "hover:ring-2 hover:ring-primary/20 transition-all duration-300",
};

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

interface CardProps {
  product: ResolvedProduct;
  basePath: string;
  currency: string;
  imageAspectRatio: string;
  showPrice: boolean;
  showBadge: boolean;
  cardBorderRadius: string;
  cardShadow: string;
  hoverEffect: string;
  textAlign: string;
}

function StandardCard({
  product,
  basePath,
  currency,
  imageAspectRatio,
  showPrice,
  showBadge,
  cardBorderRadius,
  cardShadow,
  hoverEffect,
  textAlign,
}: CardProps) {
  const hasDiscount =
    product.compareAtPrice &&
    parseFloat(product.compareAtPrice) > parseFloat(product.price);

  const priceDisplay =
    product.hasVariants && product.minVariantPrice
      ? `From ${formatPrice(product.minVariantPrice, currency)}`
      : formatPrice(product.price, currency);

  return (
    <Link
      href={`${basePath}/product/${product.slug}`}
      className={cn(
        "group block overflow-hidden border bg-card",
        borderRadiusMap[cardBorderRadius] || "rounded-lg",
        shadowMap[cardShadow],
        hoverEffectMap[hoverEffect]
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden bg-muted",
          aspectRatioClasses[imageAspectRatio] || "aspect-square"
        )}
      >
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.imageAlt || product.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ShoppingBag className="h-10 w-10" />
          </div>
        )}
        {showBadge && hasDiscount && (
          <div className="absolute top-2 right-2 rounded-md bg-red-500 px-1.5 py-0.5 text-xs font-semibold text-white">
            Sale
          </div>
        )}
      </div>
      <div className={cn("p-3", textAlign === "center" && "text-center")}>
        <h3 className="text-sm font-medium line-clamp-2 sm:text-base">
          {product.name}
        </h3>
        {showPrice && (
          <div
            className={cn(
              "mt-1 flex items-center gap-2",
              textAlign === "center" && "justify-center"
            )}
          >
            <span className="text-sm font-semibold">{priceDisplay}</span>
            {hasDiscount && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(product.compareAtPrice!, currency)}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

function MinimalCard({
  product,
  basePath,
  currency,
  imageAspectRatio,
  showPrice,
  showBadge,
  cardBorderRadius,
  cardShadow,
  hoverEffect,
  textAlign,
}: CardProps) {
  const hasDiscount =
    product.compareAtPrice &&
    parseFloat(product.compareAtPrice) > parseFloat(product.price);

  const priceDisplay =
    product.hasVariants && product.minVariantPrice
      ? `From ${formatPrice(product.minVariantPrice, currency)}`
      : formatPrice(product.price, currency);

  return (
    <Link
      href={`${basePath}/product/${product.slug}`}
      className={cn("group block", hoverEffectMap[hoverEffect])}
    >
      <div
        className={cn(
          "relative overflow-hidden bg-muted",
          borderRadiusMap[cardBorderRadius] || "rounded-lg",
          shadowMap[cardShadow],
          aspectRatioClasses[imageAspectRatio] || "aspect-square"
        )}
      >
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.imageAlt || product.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ShoppingBag className="h-10 w-10" />
          </div>
        )}
        {showBadge && hasDiscount && (
          <div className="absolute top-2 right-2 rounded-md bg-red-500 px-1.5 py-0.5 text-xs font-semibold text-white">
            Sale
          </div>
        )}
      </div>
      <div className={cn("mt-2.5", textAlign === "center" && "text-center")}>
        <h3 className="text-sm font-medium line-clamp-2 group-hover:underline">
          {product.name}
        </h3>
        {showPrice && (
          <div
            className={cn(
              "mt-0.5 flex items-center gap-2",
              textAlign === "center" && "justify-center"
            )}
          >
            <span className="text-sm text-muted-foreground">
              {priceDisplay}
            </span>
            {hasDiscount && (
              <span className="text-xs text-muted-foreground/60 line-through">
                {formatPrice(product.compareAtPrice!, currency)}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

function OverlayCard({
  product,
  basePath,
  currency,
  imageAspectRatio,
  showPrice,
  showBadge,
  cardBorderRadius,
  cardShadow,
  hoverEffect,
  textAlign,
}: CardProps) {
  const hasDiscount =
    product.compareAtPrice &&
    parseFloat(product.compareAtPrice) > parseFloat(product.price);

  const priceDisplay =
    product.hasVariants && product.minVariantPrice
      ? `From ${formatPrice(product.minVariantPrice, currency)}`
      : formatPrice(product.price, currency);

  return (
    <Link
      href={`${basePath}/product/${product.slug}`}
      className={cn(
        "group relative block overflow-hidden",
        borderRadiusMap[cardBorderRadius] || "rounded-lg",
        shadowMap[cardShadow],
        hoverEffectMap[hoverEffect]
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden bg-muted",
          aspectRatioClasses[imageAspectRatio] || "aspect-square"
        )}
      >
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.imageAlt || product.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ShoppingBag className="h-10 w-10" />
          </div>
        )}
        {showBadge && hasDiscount && (
          <div className="absolute top-2 right-2 rounded-md bg-red-500 px-1.5 py-0.5 text-xs font-semibold text-white">
            Sale
          </div>
        )}
        {/* Bottom gradient overlay */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-3 pt-8",
            textAlign === "center" && "text-center"
          )}
        >
          <h3 className="text-sm font-medium text-white line-clamp-2">
            {product.name}
          </h3>
          {showPrice && (
            <div
              className={cn(
                "mt-0.5 flex items-center gap-2",
                textAlign === "center" && "justify-center"
              )}
            >
              <span className="text-sm font-semibold text-white">
                {priceDisplay}
              </span>
              {hasDiscount && (
                <span className="text-xs text-white/60 line-through">
                  {formatPrice(product.compareAtPrice!, currency)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

const cardComponents = {
  standard: StandardCard,
  minimal: MinimalCard,
  overlay: OverlayCard,
} as const;

export function ProductGridSection({
  title = "",
  columns = 4,
  showViewAll = false,
  cardStyle = "standard",
  imageAspectRatio = "square",
  showPrice = true,
  showBadge = true,
  cardBorderRadius = "md",
  cardShadow = "sm",
  hoverEffect = "lift",
  textAlign = "left",
  resolvedProducts = [],
  basePath = "/",
  currency = "AFN",
}: ProductGridSectionProps) {
  if (resolvedProducts.length === 0) {
    // In the editor (client-side), show a placeholder instead of nothing
    return (
        <section className="py-8 px-4 sm:px-6 sm:py-12 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {title && (
              <h2 className="mb-6 text-xl font-bold sm:text-2xl lg:text-3xl">
                {title}
              </h2>
            )}
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 py-12">
              <ShoppingBag className="mb-3 size-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                Product Grid
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

  const CardComponent = cardComponents[cardStyle] || StandardCard;

  return (
    <section className="py-8 px-4 sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        {(title || showViewAll) && (
          <div className="mb-6 flex items-center justify-between">
            {title && (
              <h2 className="text-xl font-bold sm:text-2xl lg:text-3xl">
                {title}
              </h2>
            )}
            {showViewAll && (
              <Link
                href={`${basePath}/products`}
                className="text-sm font-medium text-primary hover:underline"
              >
                View all
              </Link>
            )}
          </div>
        )}

        {/* Grid */}
        <div
          className={cn(
            "grid gap-3 sm:gap-4",
            columnClasses[columns] || columnClasses[4]
          )}
        >
          {resolvedProducts.map((product) => (
            <CardComponent
              key={product.id}
              product={product}
              basePath={basePath}
              currency={currency}
              imageAspectRatio={imageAspectRatio}
              showPrice={showPrice}
              showBadge={showBadge}
              cardBorderRadius={cardBorderRadius}
              cardShadow={cardShadow}
              hoverEffect={hoverEffect}
              textAlign={textAlign}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
