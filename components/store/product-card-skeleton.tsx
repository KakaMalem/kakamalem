import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductCardSkeletonProps {
  className?: string;
}

export function ProductCardSkeleton({ className }: ProductCardSkeletonProps) {
  return (
    <article
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border bg-background",
        className
      )}
    >
      {/* Image Skeleton - taller aspect ratio */}
      <div className="relative aspect-4/5 overflow-hidden bg-muted/30">
        <Skeleton className="absolute inset-0 rounded-none" />
      </div>

      {/* Content - Price first layout */}
      <div className="flex flex-1 flex-col p-2.5">
        {/* Price */}
        <Skeleton className="h-4 w-16" />

        {/* Product Name */}
        <div className="mt-1.5 space-y-1">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>

        {/* Rating */}
        <div className="mt-1.5 flex items-center gap-1">
          <Skeleton className="size-3 rounded-full" />
          <Skeleton className="h-2.5 w-6" />
          <Skeleton className="h-2.5 w-8" />
        </div>

        {/* Spacer */}
        <div className="flex-1 min-h-1" />

        {/* Action Buttons */}
        <div className="mt-2 flex gap-1.5">
          <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
          <Skeleton className="h-8 flex-1 rounded-lg" />
        </div>
      </div>
    </article>
  );
}

interface ProductGridSkeletonProps {
  count?: number;
  className?: string;
}

export function ProductGridSkeleton({
  count = 12,
  className,
}: ProductGridSkeletonProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
