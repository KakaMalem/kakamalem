"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Star, Camera, Images } from "lucide-react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import { cn } from "@/lib/utils";
import type { ReviewMediaItem } from "@/lib/db/queries/reviews";

interface ReviewPhotoGalleryProps {
  media: ReviewMediaItem[];
  maxDisplay?: number;
}

/**
 * UGC (User Generated Content) gallery showing customer photos from reviews
 * Features: Lightbox with zoom, thumbnails, swipe navigation
 */
export function ReviewPhotoGallery({
  media,
  maxDisplay = 8,
}: ReviewPhotoGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (media.length === 0) {
    return null;
  }

  const displayMedia = media.slice(0, maxDisplay);
  const remainingCount = media.length - maxDisplay;

  // Prepare lightbox slides
  const slides = media.map((item) => ({
    src: item.url || "",
    alt: `Photo by ${item.reviewerName}`,
  }));

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Camera className="size-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Customer Photos</h3>
              <p className="text-xs text-muted-foreground">
                {media.length} {media.length === 1 ? "photo" : "photos"} from
                verified buyers
              </p>
            </div>
          </div>
          {media.length > maxDisplay && (
            <button
              onClick={() => openLightbox(0)}
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              <Images className="size-3.5" />
              View all {media.length}
            </button>
          )}
        </div>

        {/* Photo Grid */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
          {displayMedia.map((item, index) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => openLightbox(index)}
              className={cn(
                "relative shrink-0 rounded-xl overflow-hidden bg-muted group",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                "shadow-sm hover:shadow-md transition-shadow",
                index === 0 ? "size-28 sm:size-32" : "size-20 sm:size-24"
              )}
            >
              {item.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt={`Customer photo by ${item.reviewerName}`}
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-110"
                  loading="lazy"
                />
              ) : (
                <div className="size-full flex items-center justify-center bg-muted">
                  <Camera className="size-6 text-muted-foreground" />
                </div>
              )}

              {/* Overlay gradient */}
              <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Rating badge */}
              <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm text-white px-1.5 py-0.5 rounded-full text-xs font-medium">
                <Star className="size-3 fill-amber-400 text-amber-400" />
                {item.reviewRating}
              </div>

              {/* Reviewer name on hover */}
              <div className="absolute bottom-1.5 right-1.5 max-w-3/5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] text-white/90 font-medium">
                  {item.reviewerName}
                </span>
              </div>
            </motion.button>
          ))}

          {/* Show more button */}
          {remainingCount > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: maxDisplay * 0.05 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => openLightbox(maxDisplay)}
              className={cn(
                "shrink-0 size-20 sm:size-24 rounded-xl bg-muted/80 border-2 border-dashed border-muted-foreground/20",
                "flex flex-col items-center justify-center gap-1",
                "hover:bg-muted hover:border-primary/30 transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              )}
            >
              <Images className="size-5 text-muted-foreground" />
              <span className="text-sm font-semibold text-muted-foreground">
                +{remainingCount}
              </span>
              <span className="text-[10px] text-muted-foreground/70">more</span>
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Lightbox */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={slides}
        plugins={[Zoom, Counter, Thumbnails]}
        carousel={{
          finite: slides.length <= 10,
          preload: 2,
        }}
        animation={{ fade: 250, swipe: 250 }}
        controller={{ closeOnBackdropClick: true }}
        zoom={{
          maxZoomPixelRatio: 3,
          scrollToZoom: true,
        }}
        thumbnails={{
          position: "bottom",
          width: 80,
          height: 60,
          padding: 4,
          gap: 8,
        }}
        styles={{
          container: { backgroundColor: "rgba(0, 0, 0, 0.95)" },
          thumbnailsContainer: { backgroundColor: "rgba(0, 0, 0, 0.8)" },
        }}
        on={{
          view: ({ index }) => setLightboxIndex(index),
        }}
        render={{
          slideFooter: () => {
            const currentMedia = media[lightboxIndex];
            if (!currentMedia) return null;
            return (
              <div className="absolute bottom-20 left-0 right-0 flex justify-center">
                <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-3">
                  <span className="text-white text-sm font-medium">
                    {currentMedia.reviewerName}
                  </span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={cn(
                          "size-3.5",
                          star <= currentMedia.reviewRating
                            ? "fill-amber-400 text-amber-400"
                            : "fill-white/30 text-white/30"
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          },
        }}
      />
    </>
  );
}
