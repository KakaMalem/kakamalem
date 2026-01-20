import { cn } from "@/lib/utils";

/**
 * Skeleton loader for the store header
 * Matches the layout of the actual StoreHeader component
 */
export function StoreHeaderSkeleton() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Desktop Header Skeleton */}
        <div className="hidden h-16 items-center gap-6 md:flex">
          {/* Left: Logo / Store Name Skeleton */}
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="size-9 animate-pulse rounded-lg bg-muted" />
            <div className="h-5 w-32 animate-pulse rounded bg-muted" />
          </div>

          {/* Center: Search Bar Skeleton */}
          <div className="flex flex-1 justify-center">
            <div className="h-10 w-full max-w-lg animate-pulse rounded-md bg-muted" />
          </div>

          {/* Right: Actions Skeleton */}
          <div className="flex shrink-0 items-center gap-2">
            {/* Cart Button */}
            <div className="size-10 animate-pulse rounded-md bg-muted" />
            {/* Auth Buttons */}
            <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
            <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
          </div>
        </div>

        {/* Mobile Header Skeleton */}
        <div className="flex flex-col gap-3 py-3 md:hidden">
          {/* Top Row: Logo, Cart, Profile */}
          <div className="flex items-center justify-between">
            {/* Left: Logo / Store Name Skeleton */}
            <div className="flex shrink-0 items-center gap-2">
              <div className="size-8 animate-pulse rounded-lg bg-muted" />
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            </div>

            {/* Right: Cart & Profile Skeleton */}
            <div className="flex items-center gap-0.5">
              <div className="size-9 animate-pulse rounded-md bg-muted" />
              <div className="size-8 animate-pulse rounded-full bg-muted" />
            </div>
          </div>

          {/* Bottom Row: Search Bar Skeleton */}
          <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    </header>
  );
}

/**
 * Shimmer effect skeleton with gradient animation
 * More polished alternative to the basic skeleton
 */
export function StoreHeaderSkeletonShimmer() {
  const shimmer = cn(
    "relative overflow-hidden",
    "before:absolute before:inset-0 before:-translate-x-full",
    "before:animate-[shimmer_2s_infinite]",
    "before:bg-gradient-to-r before:from-transparent before:via-muted-foreground/10 before:to-transparent"
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Desktop Header Skeleton */}
        <div className="hidden h-16 items-center gap-6 md:flex">
          {/* Left: Logo / Store Name Skeleton */}
          <div className="flex shrink-0 items-center gap-2.5">
            <div className={cn("size-9 rounded-lg bg-muted", shimmer)} />
            <div className={cn("h-5 w-32 rounded bg-muted", shimmer)} />
          </div>

          {/* Center: Search Bar Skeleton */}
          <div className="flex flex-1 justify-center">
            <div
              className={cn(
                "h-10 w-full max-w-lg rounded-md bg-muted",
                shimmer
              )}
            />
          </div>

          {/* Right: Actions Skeleton */}
          <div className="flex shrink-0 items-center gap-2">
            <div className={cn("size-10 rounded-md bg-muted", shimmer)} />
            <div className={cn("h-9 w-20 rounded-md bg-muted", shimmer)} />
            <div className={cn("h-9 w-24 rounded-md bg-muted", shimmer)} />
          </div>
        </div>

        {/* Mobile Header Skeleton */}
        <div className="flex flex-col gap-3 py-3 md:hidden">
          {/* Top Row */}
          <div className="flex items-center justify-between">
            <div className="flex shrink-0 items-center gap-2">
              <div className={cn("size-8 rounded-lg bg-muted", shimmer)} />
              <div className={cn("h-4 w-28 rounded bg-muted", shimmer)} />
            </div>
            <div className="flex items-center gap-0.5">
              <div className={cn("size-9 rounded-md bg-muted", shimmer)} />
              <div className={cn("size-8 rounded-full bg-muted", shimmer)} />
            </div>
          </div>

          {/* Bottom Row */}
          <div className={cn("h-10 w-full rounded-md bg-muted", shimmer)} />
        </div>
      </div>
    </header>
  );
}
