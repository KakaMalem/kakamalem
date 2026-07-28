"use client";

import Link from "next/link";
import Image from "next/image";
import { Grid3X3, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { useStoreBasePath } from "@/components/store/store-path-provider";

export interface CategoryCardData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  productCount: number;
  /** First product photo in the category, used when imageUrl is null */
  coverImageUrl?: string | null;
}

interface CategoryCardProps {
  category: CategoryCardData;
  /**
   * "feature" spans two columns and lays out side-by-side on desktop.
   * Used to break up the grid — see CategoryShowcase.
   */
  variant?: "standard" | "feature";
  /** Eager-load + preload this cover; set on the first card (likely LCP) */
  priority?: boolean;
  className?: string;
}

const linkFocusRing =
  "rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * An empty category links to a page with nothing on it, and the dimmed styling
 * already reads as unavailable — so it renders as a plain container instead of
 * a link, and the affordance matches the behaviour.
 *
 * Declared at module scope on purpose: an inline component would get a new
 * identity every render and remount the card (and re-request its image).
 */
function CardShell({
  isEmpty,
  href,
  ariaLabel,
  className,
  children,
}: {
  isEmpty: boolean;
  href: string;
  ariaLabel: string;
  className: string;
  children: React.ReactNode;
}) {
  if (isEmpty) {
    return <div className={className}>{children}</div>;
  }
  return (
    <Link href={href} aria-label={ariaLabel} className={className}>
      {children}
    </Link>
  );
}

/** Placeholder for categories with no image of their own and no products yet. */
function CoverPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center bg-linear-to-br from-muted to-muted/50">
      <Grid3X3 className="size-12 text-muted-foreground/25 sm:size-16" />
    </div>
  );
}

export function CategoryCard({
  category,
  variant = "standard",
  priority = false,
  className,
}: CategoryCardProps) {
  const basePath = useStoreBasePath();

  // Sellers rarely upload category images — borrowing the first product photo
  // is what keeps the grid from being a wall of grey boxes.
  const cover = category.imageUrl || category.coverImageUrl || null;
  const isEmpty = category.productCount === 0;
  const href = `${basePath}/category/${category.slug}`;

  const countLabel = isEmpty
    ? "Coming soon"
    : `${category.productCount} ${category.productCount === 1 ? "item" : "items"}`;

  // Matches the visible badge wording — a different phrasing here would break
  // label-in-name for anyone driving the page by voice.
  const ariaLabel = isEmpty
    ? `${category.name}, coming soon`
    : `${category.name}, ${countLabel}`;

  const imageEl = cover ? (
    <Image
      src={cover}
      alt=""
      aria-hidden
      fill
      priority={priority}
      className="object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transform-none"
      sizes={
        variant === "feature"
          ? "(max-width: 767px) 100vw, 45vw"
          : "(max-width: 767px) 50vw, 25vw"
      }
    />
  ) : (
    <CoverPlaceholder />
  );

  if (variant === "feature") {
    return (
      <CardShell
        isEmpty={isEmpty}
        href={href}
        ariaLabel={ariaLabel}
        className={cn("group col-span-2 block", linkFocusRing, className)}
      >
        <article
          className={cn(
            // md:min-h-56 is load-bearing: on desktop the image pane drops its
            // aspect ratio and stretches to the row height, which inside the
            // mosaic comes from the taller standard cards beside it. With only
            // one or two categories there are no standard cards, so without a
            // floor the card would shrink to the height of its own text.
            "flex h-full flex-col overflow-hidden rounded-2xl bg-muted/30 ring-1 ring-border/60 transition-all duration-500 md:min-h-56 md:flex-row",
            "motion-reduce:transition-none",
            !isEmpty && "hover:shadow-xl hover:shadow-black/10"
          )}
        >
          {/* Image pane — fixed ratio on mobile (alone in its row, so nothing
              else sets the height), stretched to the row height on desktop.
              Dimming is scoped to the image so the text keeps full contrast. */}
          <div
            className={cn(
              "relative aspect-16/10 w-full shrink-0 overflow-hidden md:aspect-auto md:w-1/2 md:self-stretch",
              isEmpty && "opacity-70 saturate-50"
            )}
          >
            {imageEl}
          </div>

          {/* Content pane — solid surface, so long copy has no contrast risk */}
          <div className="flex flex-1 flex-col justify-center gap-2 p-4 sm:p-5">
            <span className="inline-flex w-fit items-center rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-border">
              {countLabel}
            </span>
            <h3 className="text-balance text-lg font-bold tracking-tight sm:text-xl">
              {category.name}
            </h3>
            {category.description && (
              <p className="line-clamp-2 text-pretty text-sm text-muted-foreground">
                {category.description}
              </p>
            )}
            {!isEmpty && (
              <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                Browse collection
                <ArrowRight
                  aria-hidden
                  className="size-4 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transform-none"
                />
              </span>
            )}
          </div>
        </article>
      </CardShell>
    );
  }

  return (
    <CardShell
      isEmpty={isEmpty}
      href={href}
      ariaLabel={ariaLabel}
      className={cn("group block", linkFocusRing, className)}
    >
      <article
        className={cn(
          "relative h-full overflow-hidden rounded-2xl bg-muted/30 ring-1 ring-border/60 transition-all duration-500",
          "motion-reduce:transition-none",
          !isEmpty && "hover:shadow-xl hover:shadow-black/10"
        )}
      >
        <div className="relative aspect-4/5 overflow-hidden">
          {/* Dim only the photo — dimming the whole card would drag the
              white-on-scrim text below contrast minimums too. */}
          <div
            className={cn(
              "absolute inset-0",
              isEmpty && "opacity-70 saturate-50"
            )}
          >
            {imageEl}
          </div>

          {/* Always-on scrim. It used to darken further on hover, which meant
              touch devices never got a readable overlay at all. */}
          <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/45 via-45% to-black/10" />

          <span className="absolute right-2.5 top-2.5 inline-flex items-center rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
            {countLabel}
          </span>

          <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white drop-shadow-[0_1px_3px_rgb(0_0_0/0.6)] sm:text-base">
              {category.name}
            </h3>
            {!isEmpty && (
              <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-white/85">
                Browse
                <ArrowRight
                  aria-hidden
                  className="size-3.5 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transform-none"
                />
              </span>
            )}
          </div>
        </div>
      </article>
    </CardShell>
  );
}
