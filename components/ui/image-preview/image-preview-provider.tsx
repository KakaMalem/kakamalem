"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import LightGallery from "lightgallery/react";
import type { LightGallery as LightGalleryType } from "lightgallery/lightgallery";

// Styles
import "lightgallery/css/lightgallery.css";
import "lightgallery/css/lg-zoom.css";
import "lightgallery/css/lg-thumbnail.css";

// Plugins
import lgZoom from "lightgallery/plugins/zoom";
import lgThumbnail from "lightgallery/plugins/thumbnail";

// Class added to body when lightgallery is open
const LIGHTGALLERY_OPEN_CLASS = "lightgallery-open";

// =============================================================================
// TYPES
// =============================================================================

export interface PreviewImage {
  src: string;
  alt?: string;
  thumb?: string;
}

interface ImagePreviewContextValue {
  /**
   * Open the image preview gallery
   * @param images Array of images to display
   * @param startIndex Index of the image to open initially (0-based)
   */
  openPreview: (images: PreviewImage[], startIndex?: number) => void;
}

// =============================================================================
// CONTEXT
// =============================================================================

const ImagePreviewContext = createContext<ImagePreviewContextValue | null>(
  null
);

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook to access the image preview functionality.
 * Must be used within an ImagePreviewProvider.
 *
 * @example
 * ```tsx
 * const { openPreview } = useImagePreview();
 *
 * const handleClick = () => {
 *   openPreview([{ src: "/image1.jpg" }, { src: "/image2.jpg" }], 0);
 * };
 * ```
 */
export function useImagePreview() {
  const context = useContext(ImagePreviewContext);
  if (!context) {
    throw new Error("useImagePreview must be used within ImagePreviewProvider");
  }
  return context;
}

// =============================================================================
// PROVIDER
// =============================================================================

interface ImagePreviewProviderProps {
  children: ReactNode;
}

/**
 * Global provider for image preview functionality.
 * Place this at the root of your app (e.g., in layout.tsx).
 * Uses a single LightGallery instance to avoid conflicts.
 */
export function ImagePreviewProvider({ children }: ImagePreviewProviderProps) {
  const lightGalleryRef = useRef<LightGalleryType | null>(null);
  const [images, setImages] = useState<PreviewImage[]>([]);
  const [startIndex, setStartIndex] = useState(0);
  const [key, setKey] = useState(0);

  const onInit = useCallback((detail: { instance: LightGalleryType }) => {
    lightGalleryRef.current = detail.instance;
  }, []);

  // Add class to body when lightgallery opens (to disable dialog interactions)
  const onAfterOpen = useCallback(() => {
    document.body.classList.add(LIGHTGALLERY_OPEN_CLASS);
  }, []);

  // Remove class when lightgallery closes (with delay to prevent parent dialogs from closing)
  const onAfterClose = useCallback(() => {
    // Delay removal so parent dialogs can check if preview was open before closing
    setTimeout(() => {
      document.body.classList.remove(LIGHTGALLERY_OPEN_CLASS);
    }, 100);
  }, []);

  const openPreview = useCallback(
    (newImages: PreviewImage[], index: number = 0) => {
      // Update images and trigger re-render of LightGallery
      setImages(newImages);
      setStartIndex(index);
      setKey((prev) => prev + 1);

      // Use setTimeout to ensure LightGallery has updated with new images
      setTimeout(() => {
        lightGalleryRef.current?.openGallery(index);
      }, 50);
    },
    []
  );

  // Convert images to dynamic source format
  const dynamicEl = images.map((img) => ({
    src: img.src,
    thumb: img.thumb || img.src,
    alt: img.alt || "",
    subHtml: img.alt ? `<p>${img.alt}</p>` : undefined,
  }));

  // Build plugins array - always include both, thumbnail only shows when multiple images
  const plugins = [lgZoom, lgThumbnail];

  return (
    <ImagePreviewContext.Provider value={{ openPreview }}>
      {children}
      {/* Single global LightGallery instance */}
      <LightGallery
        key={key}
        onInit={onInit}
        onAfterOpen={onAfterOpen}
        onAfterClose={onAfterClose}
        dynamic
        dynamicEl={dynamicEl}
        plugins={plugins}
        mode="lg-fade"
        download={false}
        counter={images.length > 1}
        hideControlOnEnd={false}
        closable
        showMaximizeIcon
        index={startIndex}
      />
    </ImagePreviewContext.Provider>
  );
}
