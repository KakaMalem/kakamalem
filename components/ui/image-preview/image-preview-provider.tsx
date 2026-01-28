"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Lightbox, { type Slide } from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";

// Import YARL styles
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";

// Class added to body when lightbox is open (for dialog coordination)
const LIGHTBOX_OPEN_CLASS = "lightgallery-open";

// =============================================================================
// PORTAL CONTAINER SINGLETON
// =============================================================================

let portalContainer: HTMLDivElement | null = null;
const subscribers = new Set<() => void>();

function getPortalContainer() {
  return portalContainer;
}

function subscribe(callback: () => void) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

function ensurePortalContainer() {
  if (typeof document === "undefined") return null;

  if (!portalContainer) {
    portalContainer = document.createElement("div");
    portalContainer.id = "image-preview-portal";
    portalContainer.style.position = "relative";
    portalContainer.style.zIndex = "2147483647";
    document.body.appendChild(portalContainer);
    subscribers.forEach((cb) => cb());
  }
  return portalContainer;
}

// =============================================================================
// TYPES
// =============================================================================

export interface PreviewImage {
  src: string;
  alt?: string;
  thumb?: string;
}

interface ImagePreviewContextValue {
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

export function ImagePreviewProvider({ children }: ImagePreviewProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Track if close was triggered by popstate (back button)
  const closedViaPopstateRef = useRef(false);

  // Use external store pattern for portal container
  const container = useSyncExternalStore(
    subscribe,
    getPortalContainer,
    () => null // Server snapshot
  );

  // Ensure portal container exists on mount
  useEffect(() => {
    ensurePortalContainer();
  }, []);

  // Manage body class for dialog coordination
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add(LIGHTBOX_OPEN_CLASS);
    } else {
      const timer = setTimeout(() => {
        document.body.classList.remove(LIGHTBOX_OPEN_CLASS);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Browser history integration + Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    // Push history state when lightbox opens
    window.history.pushState({ lightbox: true }, "");

    // Handle back button
    const handlePopState = () => {
      closedViaPopstateRef.current = true;
      setIsOpen(false);
    };

    // Handle Escape key directly (bypasses any Radix event handling)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        // Go back to remove history entry, then close
        window.history.back();
      }
    };

    window.addEventListener("popstate", handlePopState);
    // Use capture phase to intercept before Radix
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen]);

  const openPreview = useCallback(
    (images: PreviewImage[], startIndex: number = 0) => {
      const newSlides: Slide[] = images.map((img) => ({
        src: img.src,
        alt: img.alt || "",
      }));

      setSlides(newSlides);
      setCurrentIndex(startIndex);
      setIsOpen(true);
    },
    []
  );

  // Handle close from YARL (X button, backdrop click)
  const handleClose = useCallback(() => {
    if (!closedViaPopstateRef.current) {
      // Closed via X button or backdrop - go back to remove history entry
      window.history.back();
    }
    closedViaPopstateRef.current = false;
    setIsOpen(false);
  }, []);

  const handleView = useCallback(({ index }: { index: number }) => {
    setCurrentIndex(index);
  }, []);

  return (
    <ImagePreviewContext.Provider value={{ openPreview }}>
      {children}
      {container && (
        <Lightbox
          open={isOpen}
          close={handleClose}
          index={currentIndex}
          slides={slides}
          on={{ view: handleView }}
          portal={{ root: container }}
          plugins={[
            Zoom,
            Fullscreen,
            Counter,
            ...(slides.length > 1 ? [Thumbnails] : []),
          ]}
          zoom={{
            maxZoomPixelRatio: 4,
            zoomInMultiplier: 2,
            doubleTapDelay: 300,
            doubleClickDelay: 300,
            doubleClickMaxStops: 2,
            keyboardMoveDistance: 50,
            wheelZoomDistanceFactor: 100,
            pinchZoomDistanceFactor: 100,
            scrollToZoom: true,
          }}
          thumbnails={{
            position: "bottom",
            width: 80,
            height: 60,
            gap: 8,
            padding: 4,
            showToggle: false,
          }}
          animation={{
            fade: 250,
            swipe: 350,
            easing: {
              fade: "ease",
              swipe: "ease-out",
              navigation: "ease-in-out",
            },
          }}
          carousel={{
            finite: true,
            preload: 2,
            padding: 0,
            spacing: 0,
          }}
          controller={{
            closeOnBackdropClick: true,
            closeOnPullDown: true,
            closeOnPullUp: true,
          }}
          render={{
            buttonPrev: slides.length <= 1 ? () => null : undefined,
            buttonNext: slides.length <= 1 ? () => null : undefined,
          }}
          styles={{
            container: {
              backgroundColor: "rgba(0, 0, 0, 0.95)",
            },
          }}
          toolbar={{
            buttons: ["fullscreen", "zoom", "close"],
          }}
        />
      )}
    </ImagePreviewContext.Provider>
  );
}
