import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

interface ProductCardSkeletonProps {
  className?: string;
}

export function ProductCardSkeleton({ className }: ProductCardSkeletonProps) {
  return (
    <Card
      className={cn(
        "relative w-full overflow-hidden border-0 shadow-sm bg-card rounded-xl flex flex-col p-0 gap-0",
        className
      )}
    >
      {/* Image Skeleton */}
      <div className="relative aspect-4/5 overflow-hidden">
        <Skeleton className="absolute inset-0 rounded-none" />
      </div>

      {/* Content */}
      <div className="p-2.5 flex flex-col flex-1">
        {/* Price Row */}
        <div className="flex items-baseline gap-1.5">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>

        {/* Product Name - 2 lines */}
        <div className="mt-1.5 space-y-1">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>

        {/* Rating Row */}
        <div className="flex items-center gap-2 mt-1.5">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-16" />
        </div>

        {/* Spacer */}
        <div className="flex-1 min-h-1" />

        {/* Add to Cart Button */}
        <Skeleton className="w-full h-8 mt-2 rounded-lg" />
      </div>
    </Card>
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
        "grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4 xl:grid-cols-5",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
