"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Star, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ReviewRatingBreakdownProps {
  averageRating: number | null;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  onFilterByRating?: (rating: number | null) => void;
}

export function ReviewRatingBreakdown({
  averageRating,
  totalReviews,
  ratingDistribution,
}: ReviewRatingBreakdownProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentFilter = searchParams.get("rating");

  if (totalReviews === 0) {
    return null;
  }

  const handleFilterClick = (rating: number) => {
    const params = new URLSearchParams(searchParams.toString());

    if (currentFilter === String(rating)) {
      // Toggle off if already selected
      params.delete("rating");
    } else {
      params.set("rating", String(rating));
    }

    // Keep sort param if exists
    const newUrl = params.toString()
      ? `?${params.toString()}#reviews`
      : "#reviews";
    router.push(newUrl, { scroll: false });
  };

  const clearFilter = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("rating");
    const newUrl = params.toString()
      ? `?${params.toString()}#reviews`
      : "#reviews";
    router.push(newUrl, { scroll: false });
  };

  // Calculate rating quality text
  const getRatingQuality = (rating: number) => {
    if (rating >= 4.5)
      return {
        text: "Excellent",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
      };
    if (rating >= 4)
      return { text: "Very Good", color: "text-lime-600", bg: "bg-lime-50" };
    if (rating >= 3.5)
      return { text: "Good", color: "text-yellow-600", bg: "bg-yellow-50" };
    if (rating >= 3)
      return { text: "Average", color: "text-orange-600", bg: "bg-orange-50" };
    return { text: "Below Average", color: "text-red-600", bg: "bg-red-50" };
  };

  const quality = averageRating ? getRatingQuality(averageRating) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 sm:p-6 bg-card border rounded-2xl shadow-sm"
    >
      {/* Average Rating - Compact Hero */}
      <div className="flex items-center gap-4 pb-5 mb-5 border-b">
        <motion.div
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="flex items-baseline"
        >
          <span className="text-5xl font-bold tracking-tight">
            {averageRating?.toFixed(1) ?? "0.0"}
          </span>
          <span className="text-2xl text-muted-foreground/60 ml-1">/5</span>
        </motion.div>

        <div className="flex-1 min-w-0">
          {/* Stars */}
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => {
              const filled = star <= Math.floor(averageRating ?? 0);
              const partial = !filled && star === Math.ceil(averageRating ?? 0);
              const fillPercentage = partial
                ? ((averageRating ?? 0) % 1) * 100
                : 0;

              return (
                <div key={star} className="relative">
                  <Star
                    className={cn(
                      "size-5",
                      filled
                        ? "fill-amber-400 text-amber-400"
                        : "fill-muted text-muted"
                    )}
                  />
                  {partial && (
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ width: `${fillPercentage}%` }}
                    >
                      <Star className="size-5 fill-amber-400 text-amber-400" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quality badge */}
          {quality && (
            <div
              className={cn(
                "inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
                quality.color,
                quality.bg
              )}
            >
              <TrendingUp className="size-3" />
              {quality.text}
            </div>
          )}
        </div>
      </div>

      {/* Rating Distribution */}
      <div className="space-y-1.5">
        {[5, 4, 3, 2, 1].map((rating) => {
          const count = ratingDistribution[rating] || 0;
          const percentage =
            totalReviews > 0 ? (count / totalReviews) * 100 : 0;
          const isActive = currentFilter === String(rating);

          return (
            <motion.button
              key={rating}
              onClick={() => handleFilterClick(rating)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={cn(
                "w-full flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg transition-all",
                "hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isActive &&
                  "bg-amber-50 hover:bg-amber-100/80 ring-1 ring-amber-200"
              )}
            >
              {/* Rating label */}
              <div className="flex items-center gap-1 w-8 shrink-0">
                <span
                  className={cn(
                    "text-sm font-medium tabular-nums",
                    isActive ? "text-amber-700" : "text-muted-foreground"
                  )}
                >
                  {rating}
                </span>
                <Star
                  className={cn(
                    "size-3",
                    isActive
                      ? "fill-amber-500 text-amber-500"
                      : "fill-amber-400 text-amber-400"
                  )}
                />
              </div>

              {/* Progress bar */}
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{
                    duration: 0.5,
                    ease: "easeOut",
                    delay: (5 - rating) * 0.08,
                  }}
                  className={cn(
                    "h-full rounded-full transition-colors",
                    isActive ? "bg-amber-500" : "bg-amber-400"
                  )}
                />
              </div>

              {/* Count */}
              <span
                className={cn(
                  "text-xs tabular-nums w-8 text-right shrink-0",
                  isActive
                    ? "text-amber-700 font-medium"
                    : "text-muted-foreground"
                )}
              >
                {count}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Active Filter Indicator */}
      {currentFilter && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-4 pt-4 border-t"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              Filtering by {currentFilter} stars
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilter}
              className="h-7 px-2 text-xs gap-1 hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="size-3" />
              Clear
            </Button>
          </div>
        </motion.div>
      )}

      {/* Hint text */}
      {!currentFilter && (
        <p className="text-[11px] text-muted-foreground/60 mt-4 text-center">
          Click to filter by rating
        </p>
      )}
    </motion.div>
  );
}
