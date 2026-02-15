"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, LayoutGrid, Package } from "lucide-react";
import { useRef, useState, useEffect, useCallback } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useStoreBasePath } from "@/components/store/store-path-provider";

interface StoreCategoriesBarProps {
  categories: {
    id: string;
    name: string;
    slug: string;
    imageUrl: string | null;
  }[];
  storeSlug: string;
}

export function StoreCategoriesBar({
  categories,
  storeSlug: _storeSlug,
}: StoreCategoriesBarProps) {
  const pathname = usePathname();
  const basePath = useStoreBasePath();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  // Check if at least one category has an image
  const hasAnyImage = categories.some((cat) => cat.imageUrl);

  // Determine if categories bar should be shown on this page
  const storeHome = basePath || "/";
  const isHomepage = pathname === storeHome || pathname === `${storeHome}/`;
  const shouldShowCategoriesBar =
    isHomepage ||
    pathname?.startsWith(`${basePath}/category/`) || // Category pages
    pathname?.startsWith(`${basePath}/products`) || // Products pages
    pathname?.startsWith(`${basePath}/categories`); // Categories listing page

  const checkScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 2);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    const scrollElement = scrollRef.current;

    // Use ResizeObserver for more reliable size change detection
    const resizeObserver = new ResizeObserver(checkScroll);
    if (scrollElement) {
      resizeObserver.observe(scrollElement);
    }

    window.addEventListener("resize", checkScroll);
    return () => {
      window.removeEventListener("resize", checkScroll);
      resizeObserver.disconnect();
    };
  }, [checkScroll]);

  // Handle page scroll to show/hide the categories bar
  useEffect(() => {
    const scrollThreshold = 10; // Minimum scroll to trigger
    const hideThreshold = 150; // Start hiding after this scroll position

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDiff = currentScrollY - lastScrollY.current;

      // Always show at top of page
      if (currentScrollY < hideThreshold) {
        setIsVisible(true);
        lastScrollY.current = currentScrollY;
        return;
      }

      // Only trigger if scrolled more than threshold
      if (Math.abs(scrollDiff) > scrollThreshold) {
        if (scrollDiff > 0) {
          // Scrolling down - hide
          setIsVisible(false);
        } else {
          // Scrolling up - show
          setIsVisible(true);
        }
        lastScrollY.current = currentScrollY;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.6;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // Don't show on cart, checkout, product detail pages, etc.
  if (!shouldShowCategoriesBar || categories.length === 0) {
    return null;
  }

  const isAllActive = isHomepage;

  // Show circular design if at least one category has an image
  if (hasAnyImage) {
    return (
      <section
        className={cn(
          "sticky top-28 z-40 border-b bg-background transition-transform duration-300 ease-out md:top-16",
          isVisible ? "translate-y-0" : "-translate-y-full"
        )}
      >
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          {/* Horizontal scroll container - circular design */}
          <div className="relative">
            {/* Left fade gradient */}
            <div
              className={cn(
                "pointer-events-none absolute left-0 top-0 z-10 h-full w-8 bg-linear-to-r from-background to-transparent transition-opacity duration-200",
                canScrollLeft ? "opacity-100" : "opacity-0"
              )}
            />

            {/* Left scroll button */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "absolute left-0 top-1/2 z-20 size-8 -translate-y-1/2 shrink-0 rounded-full border bg-background shadow-sm transition-all duration-200 hover:bg-accent",
                canScrollLeft
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 -translate-x-2 pointer-events-none"
              )}
              onClick={() => scroll("left")}
              aria-label="Scroll categories left"
              tabIndex={canScrollLeft ? 0 : -1}
            >
              <ChevronLeft className="size-4" />
            </Button>

            <div
              ref={scrollRef}
              onScroll={checkScroll}
              className="flex gap-4 overflow-x-auto scroll-smooth px-1 py-1 scrollbar-none md:gap-6"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              {categories.map((category) => {
                const categoryUrl = `${basePath}/category/${category.slug}`;
                // Decode both pathname and categoryUrl to handle non-English characters
                const isActive =
                  decodeURIComponent(pathname) ===
                  decodeURIComponent(categoryUrl);

                return (
                  <Link
                    key={category.id}
                    href={categoryUrl}
                    className={cn(
                      "flex flex-col items-center gap-2 shrink-0",
                      "group"
                    )}
                  >
                    <div
                      className={cn(
                        "relative size-16 md:size-20 rounded-full overflow-hidden bg-muted ring-2 transition-all",
                        isActive
                          ? "ring-primary"
                          : "ring-transparent group-hover:ring-primary/50"
                      )}
                    >
                      {category.imageUrl ? (
                        <Image
                          src={category.imageUrl}
                          alt={category.name}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <Package className="size-8 text-muted-foreground md:size-10" />
                        </div>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-xs font-medium text-center max-w-16 md:max-w-20 truncate",
                        isActive ? "text-primary" : "text-foreground"
                      )}
                    >
                      {category.name}
                    </span>
                  </Link>
                );
              })}
            </div>

            {/* Right fade gradient */}
            <div
              className={cn(
                "pointer-events-none absolute right-0 top-0 z-10 h-full w-8 bg-linear-to-l from-background to-transparent transition-opacity duration-200",
                canScrollRight ? "opacity-100" : "opacity-0"
              )}
            />

            {/* Right scroll button */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "absolute right-0 top-1/2 z-20 size-8 -translate-y-1/2 shrink-0 rounded-full border bg-background shadow-sm transition-all duration-200 hover:bg-accent",
                canScrollRight
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 translate-x-2 pointer-events-none"
              )}
              onClick={() => scroll("right")}
              aria-label="Scroll categories right"
              tabIndex={canScrollRight ? 0 : -1}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </section>
    );
  }

  // Show pill design when no images
  return (
    <nav
      className={cn(
        "sticky top-28 z-40 border-b bg-background transition-transform duration-300 ease-out md:top-16",
        isVisible ? "translate-y-0" : "-translate-y-full"
      )}
      aria-label="Product categories"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative flex items-center">
          {/* Left fade gradient */}
          <div
            className={cn(
              "pointer-events-none absolute left-0 z-10 h-full w-8 bg-linear-to-r from-background to-transparent transition-opacity duration-200",
              canScrollLeft ? "opacity-100" : "opacity-0"
            )}
          />

          {/* Left scroll button */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "absolute left-0 z-20 size-8 shrink-0 rounded-full border bg-background shadow-sm transition-all duration-200 hover:bg-accent",
              canScrollLeft
                ? "opacity-100 translate-x-0"
                : "opacity-0 -translate-x-2 pointer-events-none"
            )}
            onClick={() => scroll("left")}
            aria-label="Scroll categories left"
            tabIndex={canScrollLeft ? 0 : -1}
          >
            <ChevronLeft className="size-4" />
          </Button>

          {/* Categories scroll container */}
          <div
            ref={scrollRef}
            onScroll={checkScroll}
            className="flex items-center gap-1.5 overflow-x-auto scroll-smooth py-2.5 scrollbar-none md:gap-2 md:py-3"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
            role="list"
          >
            {/* All Products chip */}
            <Link
              href={storeHome}
              role="listitem"
              className={cn(
                "group relative flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-all duration-200 md:px-4",
                isAllActive
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-transparent bg-secondary/80 text-secondary-foreground hover:border-border hover:bg-secondary hover:shadow-sm"
              )}
            >
              <LayoutGrid
                className={cn(
                  "size-4 transition-transform duration-200 group-hover:scale-110",
                  isAllActive
                    ? "text-primary-foreground"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <span>All</span>
            </Link>

            {/* Category items */}
            {categories.map((category) => {
              const categoryUrl = `${basePath}/category/${category.slug}`;
              // Decode both pathname and categoryUrl to handle non-English characters
              const isActive =
                decodeURIComponent(pathname) ===
                decodeURIComponent(categoryUrl);

              return (
                <Link
                  key={category.id}
                  href={categoryUrl}
                  role="listitem"
                  className={cn(
                    "group relative flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-all duration-200 md:px-4",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-transparent bg-secondary/80 text-secondary-foreground hover:border-border hover:bg-secondary hover:shadow-sm"
                  )}
                >
                  <span className="max-w-24 truncate md:max-w-none">
                    {category.name}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Right fade gradient */}
          <div
            className={cn(
              "pointer-events-none absolute right-0 z-10 h-full w-8 bg-linear-to-l from-background to-transparent transition-opacity duration-200",
              canScrollRight ? "opacity-100" : "opacity-0"
            )}
          />

          {/* Right scroll button */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "absolute right-0 z-20 size-8 shrink-0 rounded-full border bg-background shadow-sm transition-all duration-200 hover:bg-accent",
              canScrollRight
                ? "opacity-100 translate-x-0"
                : "opacity-0 translate-x-2 pointer-events-none"
            )}
            onClick={() => scroll("right")}
            aria-label="Scroll categories right"
            tabIndex={canScrollRight ? 0 : -1}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
