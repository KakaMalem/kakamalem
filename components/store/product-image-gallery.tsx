"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { ImageIcon, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductLightbox } from "@/components/store/product-lightbox";

interface ProductImageGalleryProps {
  images: {
    id: string;
    url: string;
    altText: string;
  }[];
  productName: string;
  /**
   * Whether to show mobile thumbnail row below the main image.
   * Set to false for products with variants - mobile users use swipe + dots for navigation.
   * Desktop thumbnails are always shown regardless of this prop.
   * Follows Amazon/Shopify pattern for mobile variant products.
   */
  showThumbnails?: boolean;
}

export function ProductImageGallery({
  images,
  productName,
  showThumbnails = true,
}: ProductImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mounted, setMounted] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [loadedImageIds, setLoadedImageIds] = useState<Set<string>>(new Set());
  const isCurrentImageLoaded = images[currentIndex]
    ? loadedImageIds.has(images[currentIndex].id)
    : false;

  // Track client-side mount to prevent hydration mismatch with lightbox
  // This is a valid pattern for SSR/hydration safety - the one-time setState is intentional
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // Lightbox handlers
  const openLightbox = useCallback(() => {
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const handleLightboxIndexChange = useCallback(
    (index: number) => {
      if (index !== currentIndex) {
        setDirection(index > currentIndex ? 1 : -1);
        setCurrentIndex(index);
      }
    },
    [currentIndex]
  );

  // Swipe threshold - slightly higher for mobile to prevent accidental swipes
  const swipeThreshold = 50;
  const swipeVelocityThreshold = 500;
  const clickThreshold = 10; // Minimum movement to consider it a drag, not a click

  const goToImage = useCallback(
    (index: number, dir?: number) => {
      // Skip if already on this image or out of bounds
      if (index === currentIndex || index < 0 || index >= images.length) return;
      setDirection(dir ?? (index > currentIndex ? 1 : -1));
      setCurrentIndex(index);
    },
    [currentIndex, images.length]
  );

  const handleDragStart = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      dragStartRef.current = { x: info.point.x, y: info.point.y };
      setIsDragging(false);
    },
    []
  );

  const handleDrag = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      // If user has moved beyond click threshold, consider it a drag
      const dx = Math.abs(info.point.x - dragStartRef.current.x);
      const dy = Math.abs(info.point.y - dragStartRef.current.y);
      if (dx > clickThreshold || dy > clickThreshold) {
        setIsDragging(true);
      }
    },
    []
  );

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const { offset, velocity } = info;

      // Determine if we should change slides
      if (offset.x < -swipeThreshold || velocity.x < -swipeVelocityThreshold) {
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

      // Reset dragging state after a short delay to allow click prevention
      setTimeout(() => setIsDragging(false), 50);
    },
    [currentIndex, images.length, goToImage]
  );

  const handleImageClick = useCallback(() => {
    // Only open lightbox if we weren't dragging
    if (!isDragging) {
      openLightbox();
    }
  }, [isDragging, openLightbox]);

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
      <div className="aspect-square overflow-hidden rounded-xl bg-muted/30">
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <ImageIcon className="size-16 sm:size-20 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No image available</p>
        </div>
      </div>
    );
  }

  const currentImage = images[currentIndex];

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* Main Image with Swipe */}
      <div
        ref={constraintsRef}
        className="group relative aspect-square overflow-hidden rounded-xl bg-muted/20 touch-pan-y"
      >
        {/* Loading skeleton - only show for images not yet loaded */}
        {!isCurrentImageLoaded && (
          <div className="absolute inset-0 z-5 flex items-center justify-center bg-muted/30">
            <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {/* Navigation arrows (desktop only) */}
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
                "absolute left-3 top-1/2 -translate-y-1/2 z-10",
                "size-10 rounded-full bg-white/90 shadow-lg backdrop-blur-sm",
                "opacity-0 transition-all duration-200 hover:bg-white hover:scale-105",
                "hidden md:flex items-center justify-center",
                "group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
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
                if (currentIndex < images.length - 1)
                  goToImage(currentIndex + 1, 1);
              }}
              disabled={currentIndex === images.length - 1}
              className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2 z-10",
                "size-10 rounded-full bg-white/90 shadow-lg backdrop-blur-sm",
                "opacity-0 transition-all duration-200 hover:bg-white hover:scale-105",
                "hidden md:flex items-center justify-center",
                "group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                currentIndex === images.length - 1 &&
                  "opacity-0! cursor-default"
              )}
              aria-label="Next image"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}

        {/* Dots indicator (mobile) / Counter (desktop) */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
            {/* Mobile: Dots */}
            <div className="flex md:hidden items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur-sm">
              {images.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => goToImage(index)}
                  className={cn(
                    "size-2 rounded-full transition-all duration-200",
                    index === currentIndex
                      ? "bg-white w-4"
                      : "bg-white/50 hover:bg-white/70"
                  )}
                  aria-label={`Go to image ${index + 1}`}
                />
              ))}
            </div>
            {/* Desktop: Counter */}
            <div className="hidden md:block rounded-full bg-black/40 px-3 py-1.5 backdrop-blur-sm">
              <span className="text-sm font-medium text-white">
                {currentIndex + 1} / {images.length}
              </span>
            </div>
          </div>
        )}

        {/* Zoom button - opens lightbox */}
        <button
          type="button"
          onClick={openLightbox}
          className={cn(
            "absolute top-3 right-3 z-10",
            "size-10 rounded-full bg-white/90 shadow-lg backdrop-blur-sm",
            "flex items-center justify-center",
            "transition-all duration-200 hover:bg-white hover:scale-105",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          )}
          aria-label="Open image viewer"
        >
          <ZoomIn className="size-5" />
        </button>

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
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragStart={handleDragStart}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            onClick={handleImageClick}
            className="absolute inset-0 flex items-center justify-center cursor-zoom-in active:cursor-grabbing"
          >
            <Image
              src={currentImage.url}
              alt={
                currentImage.altText || `${productName} - ${currentIndex + 1}`
              }
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-contain pointer-events-none select-none"
              priority={currentIndex === 0}
              draggable={false}
              onLoad={() => {
                setLoadedImageIds((prev) => {
                  if (prev.has(currentImage.id)) return prev;
                  const next = new Set(prev);
                  next.add(currentImage.id);
                  return next;
                });
              }}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Thumbnail Grid - Mobile hidden for variant products (use swipe + dots), Desktop always shown */}
      {images.length > 1 && (
        <div className="relative">
          {/* Mobile: Horizontal scroll - hidden for variant products (showThumbnails=false) */}
          {showThumbnails && (
            <div className="flex md:hidden gap-2 overflow-x-auto p-1 -m-1 scrollbar-none snap-x snap-mandatory">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => handleThumbnailClick(index)}
                  className={cn(
                    "relative size-16 shrink-0 rounded-lg transition-all duration-200 snap-start",
                    "overflow-hidden bg-muted/20",
                    index === currentIndex
                      ? "ring-2 ring-primary ring-offset-2"
                      : "opacity-70 hover:opacity-100"
                  )}
                >
                  <Image
                    src={image.url}
                    alt={`${productName} thumbnail ${index + 1}`}
                    fill
                    sizes="64px"
                    className="object-cover"
                    draggable={false}
                  />
                </button>
              ))}
            </div>
          )}

          {/* Desktop: Grid - always shown (variant swatches supplement, don't replace thumbnails) */}
          <div className="hidden md:grid grid-cols-5 lg:grid-cols-6 gap-2 p-1 -m-1">
            {images.map((image, index) => (
              <motion.button
                key={image.id}
                type="button"
                onClick={() => handleThumbnailClick(index)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  "relative aspect-square rounded-lg transition-all duration-200",
                  "overflow-hidden bg-muted/20",
                  index === currentIndex
                    ? "ring-2 ring-primary ring-offset-2"
                    : "opacity-70 hover:opacity-100"
                )}
              >
                <Image
                  src={image.url}
                  alt={`${productName} thumbnail ${index + 1}`}
                  fill
                  sizes="80px"
                  className="object-cover"
                  draggable={false}
                />
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox for full-screen image viewing - only render after client mount */}
      {mounted && (
        <ProductLightbox
          images={images}
          open={lightboxOpen}
          index={currentIndex}
          onClose={closeLightbox}
          onIndexChange={handleLightboxIndexChange}
        />
      )}
    </div>
  );
}
