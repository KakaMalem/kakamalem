"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReviewRatingInputProps {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}

const ratingLabels: Record<number, { text: string; color: string }> = {
  1: { text: "Poor", color: "text-red-500" },
  2: { text: "Fair", color: "text-orange-500" },
  3: { text: "Good", color: "text-yellow-500" },
  4: { text: "Very Good", color: "text-lime-500" },
  5: { text: "Excellent", color: "text-emerald-500" },
};

const sizeClasses = {
  sm: "size-6",
  md: "size-8",
  lg: "size-10",
};

const containerClasses = {
  sm: "gap-0.5 p-0.5",
  md: "gap-1 p-1",
  lg: "gap-1.5 p-1.5",
};

export function ReviewRatingInput({
  value,
  onChange,
  disabled = false,
  size = "lg",
}: ReviewRatingInputProps) {
  const [hoverRating, setHoverRating] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const displayRating = hoverRating || value;
  const ratingInfo = displayRating > 0 ? ratingLabels[displayRating] : null;

  const handleSelect = (rating: number) => {
    if (disabled) return;
    setIsAnimating(true);
    onChange(rating);
    setTimeout(() => setIsAnimating(false), 300);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          "inline-flex items-center rounded-lg bg-muted/50",
          containerClasses[size]
        )}
        role="radiogroup"
        aria-label="Rating"
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const isActive = star <= displayRating;
          const isSelected = star === value;

          return (
            <motion.button
              key={star}
              type="button"
              role="radio"
              aria-checked={star === value}
              aria-label={`${star} star${star !== 1 ? "s" : ""} - ${ratingLabels[star].text}`}
              disabled={disabled}
              onClick={() => handleSelect(star)}
              onMouseEnter={() => !disabled && setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onTouchStart={() => !disabled && setHoverRating(star)}
              onTouchEnd={() => {
                if (!disabled) {
                  handleSelect(star);
                  setHoverRating(0);
                }
              }}
              className={cn(
                "relative p-1.5 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                !disabled && "hover:bg-amber-100/50 active:scale-95"
              )}
              whileHover={!disabled ? { scale: 1.1 } : undefined}
              whileTap={!disabled ? { scale: 0.95 } : undefined}
              animate={
                isSelected && isAnimating
                  ? {
                      scale: [1, 1.3, 1],
                      rotate: [0, -10, 10, 0],
                    }
                  : undefined
              }
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <Star
                className={cn(
                  sizeClasses[size],
                  "transition-all duration-200",
                  isActive
                    ? "fill-amber-400 text-amber-400 drop-shadow-sm"
                    : "fill-muted text-muted-foreground/30"
                )}
              />
              {/* Pulse effect on selection */}
              <AnimatePresence>
                {isSelected && isAnimating && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 1 }}
                    animate={{ scale: 2, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="absolute inset-0 rounded-full bg-amber-400/30"
                  />
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>

      {/* Rating label with animation */}
      <AnimatePresence mode="wait">
        {ratingInfo && (
          <motion.div
            key={displayRating}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2"
          >
            <span className={cn("text-sm font-medium", ratingInfo.color)}>
              {ratingInfo.text}
            </span>
            <span className="text-xs text-muted-foreground">
              ({displayRating}/5)
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hint text when no rating selected */}
      {!displayRating && (
        <p className="text-xs text-muted-foreground">
          Tap a star to rate this product
        </p>
      )}
    </div>
  );
}
