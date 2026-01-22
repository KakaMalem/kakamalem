"use client";

import { useCallback, useEffect, useRef } from "react";
import Lightbox, { type Slide } from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Counter from "yet-another-react-lightbox/plugins/counter";

// Import YARL styles
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";

interface ProductImage {
  id: string;
  url: string;
  altText: string;
}

interface ProductLightboxProps {
  images: ProductImage[];
  open: boolean;
  index: number;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
}

export function ProductLightbox({
  images,
  open,
  index,
  onClose,
  onIndexChange,
}: ProductLightboxProps) {
  // Track if close was triggered by popstate (back button) vs X button
  const closedViaPopstateRef = useRef(false);

  // Convert images to YARL slide format
  const slides: Slide[] = images.map((image) => ({
    src: image.url,
    alt: image.altText,
    // Provide multiple resolutions for responsive loading
    srcSet: [
      { src: image.url, width: 640, height: 640 },
      { src: image.url, width: 1080, height: 1080 },
      { src: image.url, width: 1920, height: 1920 },
    ],
  }));

  const handleView = useCallback(
    ({ index: newIndex }: { index: number }) => {
      onIndexChange?.(newIndex);
    },
    [onIndexChange]
  );

  // Handle closing - if closed via X button, also go back in history
  const handleClose = useCallback(() => {
    if (!closedViaPopstateRef.current) {
      // Closed via X button or backdrop click - go back to remove our history entry
      window.history.back();
    }
    closedViaPopstateRef.current = false;
    onClose();
  }, [onClose]);

  // Handle browser back button to close lightbox
  useEffect(() => {
    if (open) {
      // Push a new history state when lightbox opens
      window.history.pushState({ lightbox: true }, "");

      const handlePopState = () => {
        closedViaPopstateRef.current = true;
        onClose();
      };

      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    }
  }, [open, onClose]);

  if (images.length === 0) return null;

  return (
    <Lightbox
      open={open}
      close={handleClose}
      index={index}
      slides={slides}
      on={{ view: handleView }}
      plugins={[Zoom, Fullscreen, Counter]}
      // Zoom configuration - enterprise grade
      zoom={{
        maxZoomPixelRatio: 4, // Allow 4x zoom for detailed product inspection
        zoomInMultiplier: 2,
        doubleTapDelay: 300,
        doubleClickDelay: 300,
        doubleClickMaxStops: 2,
        keyboardMoveDistance: 50,
        wheelZoomDistanceFactor: 100,
        pinchZoomDistanceFactor: 100,
        scrollToZoom: true, // Enable scroll wheel zoom
      }}
      // Animation settings
      animation={{
        fade: 250,
        swipe: 350,
        easing: {
          fade: "ease",
          swipe: "ease-out",
          navigation: "ease-in-out",
        },
      }}
      // Carousel settings
      carousel={{
        finite: false, // Enable infinite loop
        preload: 2, // Preload adjacent images
        padding: 0,
        spacing: 0,
      }}
      // Controller settings
      controller={{
        closeOnBackdropClick: true,
        closeOnPullDown: true,
        closeOnPullUp: true,
      }}
      // Render settings
      render={{
        buttonPrev: images.length <= 1 ? () => null : undefined,
        buttonNext: images.length <= 1 ? () => null : undefined,
        iconZoomIn: () => (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        ),
        iconZoomOut: () => (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        ),
      }}
      // Styling
      styles={{
        container: {
          backgroundColor: "rgba(0, 0, 0, 0.95)",
        },
      }}
      // Inline styles for toolbar
      toolbar={{
        buttons: ["fullscreen", "zoom", "close"],
      }}
    />
  );
}
