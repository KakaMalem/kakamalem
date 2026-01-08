"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useDragControls, PanInfo } from "framer-motion";
import { ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductImageGalleryProps {
  images: {
    id: string;
    url: string;
    altText: string;
  }[];
  productName: string;
}

export function ProductImageGallery({
  images,
  productName,
}: ProductImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Swipe threshold
  const swipeThreshold = 50;
  const swipeVelocityThreshold = 500;

  const goToImage = useCallback((index: number, dir?: number) => {
    if (index < 0 || index >= images.length) return;
    setDirection(dir ?? (index > currentIndex ? 1 : -1));
    setCurrentIndex(index);
  }, [currentIndex, images.length]);

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const { offset, velocity } = info;

      // Determine if we should change slides
      if (
        offset.x < -swipeThreshold ||
        velocity.x < -swipeVelocityThreshold
      ) {
        // Swiped left -> go to next
        if (currentIndex < images.length - 1) {
          goToImage(currentIndex + 1, 1);
        }
      } else if (
        offset.x > swipeThreshold ||
        velocity.x > swipeVelocityThreshold
      ) {
        // Swiped right -> go to previous
        if (currentIndex > 0) {
          goToImage(currentIndex - 1, -1);
        }
      }
    },
    [currentIndex, images.length, goToImage]
  );

  const handleThumbnailClick = useCallback(
    (index: number) => {
      goToImage(index);
    },
    [goToImage]
  );

  // Animation variants for slide transitions
  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? "100%" : "-100%",
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? "-100%" : "100%",
      opacity: 0,
    }),
  };

  if (images.length === 0) {
    return (
      <div className="aspect-4/5 overflow-hidden rounded-lg border border-border/50 bg-white">
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <ImageIcon className="size-20 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No image available</p>
        </div>
      </div>
    );
  }

  const currentImage = images[currentIndex];

  return (
    <div className="flex flex-col gap-4">
      {/* Main Image with Swipe */}
      <div
        ref={constraintsRef}
        className="group relative aspect-square overflow-hidden rounded-lg border border-border/40 bg-white touch-pan-y"
      >
        {/* Navigation arrows (desktop) */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (currentIndex > 0) goToImage(currentIndex - 1, -1);
              }}
              disabled={currentIndex === 0}
              className={cn(
                "absolute left-2 top-1/2 -translate-y-1/2 z-10",
                "rounded-full bg-white/90 p-2 shadow-md backdrop-blur-sm",
                "opacity-0 transition-opacity hover:bg-white",
                "hidden md:flex items-center justify-center",
                "group-hover:opacity-100 focus:opacity-100",
                currentIndex === 0 && "opacity-0! cursor-default"
              )}
              aria-label="Previous image"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (currentIndex < images.length - 1) goToImage(currentIndex + 1, 1);
              }}
              disabled={currentIndex === images.length - 1}
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 z-10",
                "rounded-full bg-white/90 p-2 shadow-md backdrop-blur-sm",
                "opacity-0 transition-opacity hover:bg-white",
                "hidden md:flex items-center justify-center",
                "group-hover:opacity-100 focus:opacity-100",
                currentIndex === images.length - 1 && "opacity-0! cursor-default"
              )}
              aria-label="Next image"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}

        {/* Image counter */}
        {images.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 rounded-full bg-black/40 px-2.5 py-1 backdrop-blur-sm">
            <span className="text-xs font-medium text-white">
              {currentIndex + 1} / {images.length}
            </span>
          </div>
        )}

        {/* Swipeable image container */}
        <AnimatePresence mode="popLayout" custom={direction}>
          <motion.div
            key={currentImage.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            drag="x"
            dragControls={dragControls}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Image
              src={currentImage.url}
              alt={currentImage.altText || `${productName} - ${currentIndex + 1}`}
              width={1200}
              height={1200}
              className="max-h-full max-w-full object-contain pointer-events-none select-none"
              priority={currentIndex === 0}
              draggable={false}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Thumbnail Grid */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {images.map((image, index) => (
            <motion.button
              key={image.id}
              type="button"
              onClick={() => handleThumbnailClick(index)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "relative shrink-0 aspect-square rounded-md transition-all duration-200",
                "border-2 overflow-hidden bg-white",
                index === currentIndex
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border/40 hover:border-border"
              )}
              style={{ width: `calc(${100 / Math.min(images.length, 5)}% - ${(Math.min(images.length, 5) - 1) * 8 / Math.min(images.length, 5)}px)`, minWidth: 60 }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <Image
                  src={image.url}
                  alt={`${productName} thumbnail ${index + 1}`}
                  width={200}
                  height={200}
                  className="max-h-full max-w-full object-contain"
                  draggable={false}
                />
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
