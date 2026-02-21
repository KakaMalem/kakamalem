"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { Puck, usePuck } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import {
  ArrowLeft,
  Save,
  Globe,
  Eye,
  Undo2,
  Redo2,
  Loader2,
  LayoutTemplate,
  Image,
  LayoutGrid,
  ShoppingBag,
  Sparkles,
  Type,
  Minus,
  Plus,
  Megaphone,
  Images,
  MessageSquareQuote,
  LayoutDashboard,
  Keyboard,
  Smartphone,
  Tablet,
  Monitor,
  PanelTop,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Maximize2,
  Expand,
  Shrink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { puckConfig } from "@/lib/page-builder/config";
import { EditorProvider } from "@/lib/page-builder/editor-context";
import { DesignProvider } from "@/lib/page-builder/design-context";
import {
  savePageLayoutDraft,
  publishPageLayout,
  revertToPublished,
} from "@/lib/actions/page-builder";
import { VersionHistoryPanel } from "./version-history-panel";
import { DesignPanel } from "./design-panel";
import { TemplateSelector } from "./template-selector";
import { KeyboardShortcutsDialog } from "./keyboard-shortcuts-dialog";
import type { PuckPageData } from "@/lib/page-builder/types";
import type { ThemeConfig } from "@/lib/theme/types";
import type { LayoutConfig } from "@/lib/theme/layout-types";
import {
  defaultHeaderConfig,
  defaultFooterConfig,
} from "@/lib/theme/layout-types";

/** Undo/Redo buttons — must be a child component to use usePuck() hook */
function UndoRedoButtons() {
  const { history } = usePuck();
  return (
    <>
      <button
        onClick={() => history.back()}
        disabled={!history.hasPast}
        className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-30"
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className="size-4" />
      </button>
      <button
        onClick={() => history.forward()}
        disabled={!history.hasFuture}
        className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-30"
        title="Redo (Ctrl+Shift+Z)"
      >
        <Redo2 className="size-4" />
      </button>
    </>
  );
}

/**
 * Unified canvas toolbar — viewport switcher, zoom controls, sidebar toggles.
 * Fixed over the middle column (canvas area). Replaces Puck's built-in
 * ViewportControls (hidden via CSS in globals.css).
 */
function CanvasToolbar() {
  const { dispatch, appState } = usePuck();
  const leftVisible = appState.ui.leftSideBarVisible;
  const rightVisible = appState.ui.rightSideBarVisible;
  const currentWidth = appState.ui.viewports?.current?.width;
  const isFullWidth = currentWidth === "100%" || !currentWidth;
  const [edges, setEdges] = useState({ left: 0, right: 0 });
  const [zoom, setZoom] = useState(1);

  // Also suppress controls via dispatch as a safety net
  useEffect(() => {
    dispatch({
      type: "setUi",
      ui: (prev) => ({
        viewports: { ...prev.viewports, controlsVisible: false },
      }),
    });
  }, [dispatch]);

  // Apply manual zoom to the canvas inner wrapper
  useEffect(() => {
    const inner = document.querySelector<HTMLElement>(
      '[class*="PuckCanvas-inner"]'
    );
    if (!inner) return;
    if (zoom !== 1) {
      inner.style.transform = `scale(${zoom})`;
      inner.style.transformOrigin = "top center";
    } else {
      inner.style.transform = "";
      inner.style.transformOrigin = "";
    }
  }, [zoom]);

  // Measure canvas edges for toolbar positioning
  useEffect(() => {
    const sel =
      '[class*="PuckCanvas"]:not([class*="PuckCanvas-inner"]):not([class*="PuckCanvas-root"]):not([class*="PuckCanvas-control"]):not([class*="PuckCanvas-loader"])';
    const TOOLBAR_H = 41;
    const measure = () => {
      const canvas = document.querySelector<HTMLElement>(sel);
      if (canvas) {
        canvas.style.paddingTop = `${TOOLBAR_H}px`;
        const rect = canvas.getBoundingClientRect();
        setEdges({ left: rect.left, right: window.innerWidth - rect.right });
      }
    };

    measure();
    const t1 = setTimeout(measure, 100);
    const t2 = setTimeout(measure, 500);
    window.addEventListener("resize", measure);
    const obs = new ResizeObserver(measure);
    const canvas = document.querySelector<HTMLElement>(sel);
    if (canvas) obs.observe(canvas);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", measure);
      obs.disconnect();
      const c = document.querySelector<HTMLElement>(sel);
      if (c) c.style.paddingTop = "";
    };
  }, [leftVisible, rightVisible]);

  const viewports = [
    { width: 360, label: "Mobile", Icon: Smartphone },
    { width: 768, label: "Tablet", Icon: Tablet },
    { width: 1280, label: "Desktop", Icon: Monitor },
    { width: 0, label: "Full width", Icon: Maximize2 },
  ] as const;

  const setViewport = (width: number) => {
    setZoom(1); // Reset zoom when switching viewport
    dispatch({
      type: "setUi",
      ui: (prev) => ({
        viewports: {
          ...prev.viewports,
          controlsVisible: false,
          current: {
            width: width === 0 ? ("100%" as const) : width,
            height: "auto" as const,
          },
        },
      }),
    });
  };

  const zoomIn = () =>
    setZoom((prev) => Math.min(+(prev + 0.25).toFixed(2), 2));
  const zoomOut = () =>
    setZoom((prev) => Math.max(+(prev - 0.25).toFixed(2), 0.25));
  const zoomReset = () => setZoom(1);

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className="fixed z-40 flex items-center justify-between border-b bg-background/80 px-1.5 py-0.5 backdrop-blur-md"
        style={{ top: 53, left: edges.left, right: edges.right }}
      >
        {/* Left sidebar toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() =>
                dispatch({
                  type: "setUi",
                  ui: { leftSideBarVisible: !leftVisible },
                })
              }
            >
              <PanelLeft
                className={cn(
                  "size-4",
                  leftVisible ? "text-foreground" : "text-muted-foreground"
                )}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {leftVisible ? "Hide" : "Show"} sections panel
          </TooltipContent>
        </Tooltip>

        {/* Center: viewport switcher + zoom */}
        <div className="flex items-center gap-1.5">
          {/* Viewport segmented control */}
          <div className="flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5">
            {viewports.map((opt) => {
              const active =
                opt.width === 0
                  ? isFullWidth
                  : Number(currentWidth) === opt.width;
              return (
                <Tooltip key={opt.width}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setViewport(opt.width)}
                      className={cn(
                        "inline-flex items-center justify-center rounded-md p-1.5 transition-all",
                        active
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <opt.Icon className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {opt.label}
                    {opt.width > 0 ? ` (${opt.width}px)` : ""}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Divider */}
          <div className="h-4 w-px bg-border" />

          {/* Zoom controls */}
          <div className="flex items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={zoomOut}
                  disabled={zoom <= 0.25}
                >
                  <Minus className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Zoom out
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={zoomReset}
                  className="inline-flex h-7 min-w-[3rem] items-center justify-center rounded-md px-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {Math.round(zoom * 100)}%
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Reset zoom
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={zoomIn}
                  disabled={zoom >= 2}
                >
                  <Plus className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Zoom in
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Divider */}
          <div className="h-4 w-px bg-border" />

          {/* Focus mode — hide both sidebars */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => {
                  const hideAll = leftVisible || rightVisible;
                  dispatch({
                    type: "setUi",
                    ui: {
                      leftSideBarVisible: !hideAll,
                      rightSideBarVisible: !hideAll,
                    },
                  });
                }}
              >
                {!leftVisible && !rightVisible ? (
                  <Shrink className="size-3.5 text-foreground" />
                ) : (
                  <Expand className="size-3.5 text-muted-foreground" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {leftVisible || rightVisible ? "Focus mode" : "Show panels"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Right sidebar toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() =>
                dispatch({
                  type: "setUi",
                  ui: { rightSideBarVisible: !rightVisible },
                })
              }
            >
              <PanelRight
                className={cn(
                  "size-4",
                  rightVisible ? "text-foreground" : "text-muted-foreground"
                )}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {rightVisible ? "Hide" : "Show"} settings panel
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

const sectionIconMap: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  HeroBanner: Image,
  FeaturedCategories: LayoutGrid,
  ProductGrid: ShoppingBag,
  ProductSpotlight: Sparkles,
  RichText: Type,
  Spacer: Minus,
  AnnouncementBar: Megaphone,
  ImageGallery: Images,
  Testimonials: MessageSquareQuote,
  BentoGrid: LayoutDashboard,
  StoreHeader: PanelTop,
  StoreFooter: PanelBottom,
  // Enterprise sections
  VideoHero: Image,
  ProductCarousel: ShoppingBag,
  CollectionTabs: LayoutGrid,
  MarqueeBar: Megaphone,
  ContentCards: Images,
};

/** Tiny SVG thumbnail sketches for the section add-panel */
const sectionThumbnails: Record<string, React.ReactNode> = {
  HeroBanner: (
    <svg viewBox="0 0 80 48" className="w-full h-full" aria-hidden>
      <rect width="80" height="48" rx="3" fill="#e2e8f0" />
      <rect x="8" y="10" width="64" height="28" rx="2" fill="#94a3b8" opacity=".6" />
      <rect x="20" y="18" width="40" height="5" rx="1.5" fill="#fff" opacity=".8" />
      <rect x="26" y="26" width="28" height="3" rx="1" fill="#fff" opacity=".5" />
      <rect x="29" y="33" width="22" height="6" rx="2" fill="#fff" opacity=".7" />
    </svg>
  ),
  VideoHero: (
    <svg viewBox="0 0 80 48" className="w-full h-full" aria-hidden>
      <rect width="80" height="48" rx="3" fill="#1e293b" />
      <rect x="8" y="8" width="64" height="32" rx="2" fill="#334155" opacity=".7" />
      <polygon points="34,18 34,30 46,24" fill="#fff" opacity=".8" />
      <rect x="22" y="34" width="36" height="4" rx="1" fill="#fff" opacity=".3" />
    </svg>
  ),
  ProductGrid: (
    <svg viewBox="0 0 80 48" className="w-full h-full" aria-hidden>
      <rect width="80" height="48" rx="3" fill="#f8fafc" />
      {[0,1,2,3].map(i => (
        <g key={i} transform={`translate(${6 + i*18}, 8)`}>
          <rect width="15" height="18" rx="1.5" fill="#e2e8f0" />
          <rect y="20" width="15" height="3" rx="1" fill="#cbd5e1" />
          <rect y="25" width="9" height="2" rx="1" fill="#94a3b8" />
        </g>
      ))}
    </svg>
  ),
  ProductCarousel: (
    <svg viewBox="0 0 80 48" className="w-full h-full" aria-hidden>
      <rect width="80" height="48" rx="3" fill="#f8fafc" />
      <rect x="6" y="12" width="21" height="24" rx="1.5" fill="#e2e8f0" />
      <rect x="30" y="12" width="21" height="24" rx="1.5" fill="#e2e8f0" />
      <rect x="54" y="12" width="21" height="24" rx="1.5" fill="#e2e8f0" opacity=".5" />
      <circle cx="6" cy="24" r="4" fill="#94a3b8" opacity=".7" />
      <circle cx="74" cy="24" r="4" fill="#94a3b8" opacity=".7" />
    </svg>
  ),
  FeaturedCategories: (
    <svg viewBox="0 0 80 48" className="w-full h-full" aria-hidden>
      <rect width="80" height="48" rx="3" fill="#f8fafc" />
      {[0,1,2].map(i => (
        <g key={i} transform={`translate(${5 + i*26}, 8)`}>
          <rect width="22" height="24" rx="2" fill="#e2e8f0" />
          <rect y="26" width="22" height="3" rx="1" fill="#cbd5e1" />
        </g>
      ))}
    </svg>
  ),
  CollectionTabs: (
    <svg viewBox="0 0 80 48" className="w-full h-full" aria-hidden>
      <rect width="80" height="48" rx="3" fill="#f8fafc" />
      <rect x="6" y="6" width="20" height="5" rx="1.5" fill="#3b82f6" />
      <rect x="28" y="6" width="20" height="5" rx="1.5" fill="#e2e8f0" />
      <rect x="50" y="6" width="20" height="5" rx="1.5" fill="#e2e8f0" />
      {[0,1,2,3].map(i => <rect key={i} x={6+i*18} y="14" width="15" height="26" rx="2" fill="#e2e8f0" />)}
    </svg>
  ),
  ContentCards: (
    <svg viewBox="0 0 80 48" className="w-full h-full" aria-hidden>
      <rect width="80" height="48" rx="3" fill="#f8fafc" />
      {[0,1,2].map(i => (
        <g key={i} transform={`translate(${5 + i*26}, 6)`}>
          <rect width="22" height="30" rx="2" fill="#e2e8f0" />
          <rect y="20" width="22" height="10" rx="0 0 2 2" fill="#0f172a" opacity=".5" />
          <rect x="2" y="22" width="14" height="2" rx="1" fill="#fff" opacity=".8" />
          <rect x="2" y="26" width="9" height="2" rx="1" fill="#fff" opacity=".5" />
        </g>
      ))}
    </svg>
  ),
  AnnouncementBar: (
    <svg viewBox="0 0 80 48" className="w-full h-full" aria-hidden>
      <rect width="80" height="48" rx="3" fill="#f8fafc" />
      <rect x="0" y="16" width="80" height="16" fill="#0f172a" />
      <rect x="20" y="21" width="40" height="3" rx="1" fill="#fff" opacity=".8" />
      <rect x="64" y="19" width="10" height="7" rx="1" fill="#fff" opacity=".2" />
    </svg>
  ),
  MarqueeBar: (
    <svg viewBox="0 0 80 48" className="w-full h-full" aria-hidden>
      <rect width="80" height="48" rx="3" fill="#f8fafc" />
      <rect x="0" y="18" width="80" height="12" fill="#0f172a" />
      {[0,1,2,3,4].map(i => <rect key={i} x={-4+i*20} y="22" width="14" height="3" rx="1" fill="#fff" opacity=".6" />)}
    </svg>
  ),
  ImageGallery: (
    <svg viewBox="0 0 80 48" className="w-full h-full" aria-hidden>
      <rect width="80" height="48" rx="3" fill="#f8fafc" />
      <rect x="6" y="8" width="20" height="32" rx="2" fill="#e2e8f0" />
      <rect x="30" y="8" width="20" height="15" rx="2" fill="#e2e8f0" />
      <rect x="30" y="25" width="20" height="15" rx="2" fill="#e2e8f0" />
      <rect x="54" y="8" width="20" height="32" rx="2" fill="#e2e8f0" />
    </svg>
  ),
  Testimonials: (
    <svg viewBox="0 0 80 48" className="w-full h-full" aria-hidden>
      <rect width="80" height="48" rx="3" fill="#f8fafc" />
      {[0,1,2].map(i => (
        <g key={i} transform={`translate(${5+i*26}, 8)`}>
          <rect width="22" height="30" rx="2" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1" />
          <rect x="3" y="4" width="16" height="2" rx="1" fill="#94a3b8" />
          <rect x="3" y="8" width="16" height="2" rx="1" fill="#cbd5e1" />
          <rect x="3" y="12" width="11" height="2" rx="1" fill="#cbd5e1" />
          <circle cx="5" cy="23" r="4" fill="#e2e8f0" />
          <rect x="11" y="21" width="8" height="2" rx="1" fill="#cbd5e1" />
          <rect x="11" y="24" width="6" height="1.5" rx=".75" fill="#e2e8f0" />
        </g>
      ))}
    </svg>
  ),
  RichText: (
    <svg viewBox="0 0 80 48" className="w-full h-full" aria-hidden>
      <rect width="80" height="48" rx="3" fill="#f8fafc" />
      <rect x="10" y="10" width="36" height="5" rx="1.5" fill="#cbd5e1" />
      {[0,1,2,3].map(i => <rect key={i} x="10" y={20+i*6} width={i===3?30:56} height="3" rx="1" fill="#e2e8f0" />)}
    </svg>
  ),
  ProductSpotlight: (
    <svg viewBox="0 0 80 48" className="w-full h-full" aria-hidden>
      <rect width="80" height="48" rx="3" fill="#f8fafc" />
      <rect x="6" y="6" width="32" height="36" rx="2" fill="#e2e8f0" />
      <rect x="44" y="10" width="28" height="5" rx="1.5" fill="#cbd5e1" />
      <rect x="44" y="18" width="28" height="3" rx="1" fill="#e2e8f0" />
      <rect x="44" y="23" width="22" height="3" rx="1" fill="#e2e8f0" />
      <rect x="44" y="32" width="20" height="7" rx="2" fill="#3b82f6" opacity=".6" />
    </svg>
  ),
  Spacer: (
    <svg viewBox="0 0 80 48" className="w-full h-full" aria-hidden>
      <rect width="80" height="48" rx="3" fill="#f8fafc" />
      <line x1="15" y1="24" x2="65" y2="24" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 3" />
      <path d="M20 16 L15 24 L20 32" stroke="#cbd5e1" strokeWidth="1.5" fill="none" />
      <path d="M60 16 L65 24 L60 32" stroke="#cbd5e1" strokeWidth="1.5" fill="none" />
    </svg>
  ),
  BentoGrid: (
    <svg viewBox="0 0 80 48" className="w-full h-full" aria-hidden>
      <rect width="80" height="48" rx="3" fill="#f8fafc" />
      <rect x="6" y="6" width="32" height="36" rx="2" fill="#e2e8f0" />
      <rect x="42" y="6" width="32" height="16" rx="2" fill="#e2e8f0" />
      <rect x="42" y="26" width="32" height="16" rx="2" fill="#e2e8f0" />
    </svg>
  ),
  StoreHeader: (
    <svg viewBox="0 0 80 48" className="w-full h-full" aria-hidden>
      <rect width="80" height="48" rx="3" fill="#f8fafc" />
      <rect x="0" y="0" width="80" height="16" rx="3 3 0 0" fill="#0f172a" />
      <circle cx="10" cy="8" r="4" fill="#fff" opacity=".3" />
      <rect x="20" y="6" width="20" height="4" rx="1" fill="#fff" opacity=".2" />
      <rect x="55" y="5" width="8" height="6" rx="1" fill="#fff" opacity=".2" />
      <rect x="66" y="5" width="8" height="6" rx="1" fill="#fff" opacity=".2" />
      <rect x="6" y="20" width="68" height="4" rx="1" fill="#e2e8f0" />
      <rect x="6" y="28" width="50" height="3" rx="1" fill="#f1f5f9" />
    </svg>
  ),
  StoreFooter: (
    <svg viewBox="0 0 80 48" className="w-full h-full" aria-hidden>
      <rect width="80" height="48" rx="3" fill="#f8fafc" />
      <rect x="6" y="6" width="68" height="3" rx="1" fill="#e2e8f0" />
      <rect x="6" y="14" width="68" height="22" rx="2" fill="#0f172a" opacity=".85" />
      <rect x="10" y="18" width="16" height="2" rx="1" fill="#fff" opacity=".3" />
      <rect x="10" y="22" width="12" height="2" rx="1" fill="#fff" opacity=".2" />
      <rect x="10" y="26" width="14" height="2" rx="1" fill="#fff" opacity=".2" />
      <rect x="34" y="18" width="12" height="2" rx="1" fill="#fff" opacity=".2" />
      <rect x="34" y="22" width="16" height="2" rx="1" fill="#fff" opacity=".2" />
      <rect x="56" y="18" width="14" height="2" rx="1" fill="#fff" opacity=".2" />
      <rect x="0" y="40" width="80" height="8" rx="0 0 3 3" fill="#0f172a" opacity=".9" />
    </svg>
  ),
};

/**
 * Migrate old page data format to new format.
 * Old StoreHeader/StoreFooter had marker props ({ _type: "store-header" }).
 * New format stores a full config object in props.config.
 */
function migratePageData(
  data: PuckPageData,
  layoutConfig: LayoutConfig
): PuckPageData {
  const content = [...(data.content || [])];
  let changed = false;

  for (let i = 0; i < content.length; i++) {
    const section = content[i];

    // Migrate old marker-style StoreHeader to full config
    if (
      section.type === "StoreHeader" &&
      (section.props as Record<string, unknown>)._type === "store-header"
    ) {
      content[i] = {
        type: "StoreHeader",
        props: {
          id: section.props.id || "store-header",
          config: layoutConfig.header ?? defaultHeaderConfig,
        },
      };
      changed = true;
    }

    // Migrate old marker-style StoreFooter to full config
    if (
      section.type === "StoreFooter" &&
      (section.props as Record<string, unknown>)._type === "store-footer"
    ) {
      content[i] = {
        type: "StoreFooter",
        props: {
          id: section.props.id || "store-footer",
          config: layoutConfig.footer ?? defaultFooterConfig,
        },
      };
      changed = true;
    }
  }

  return changed ? { ...data, content } : data;
}

interface PageEditorClientProps {
  tenantId: string;
  storeSlug: string;
  storeName: string;
  logoUrl: string;
  currency: string;
  /** Page row ID — used for all save/publish operations */
  pageId: string;
  /** Human-readable page title shown in header breadcrumb */
  pageTitle: string;
  pageSlug: string;
  isHomepage: boolean;
  initialData: PuckPageData | null;
  hasPublished: boolean;
  initialThemeConfig: ThemeConfig;
  initialLayoutConfig: LayoutConfig;
  subscriptionPlan: string;
  customCss: string;
}

export function PageEditorClient({
  tenantId,
  storeSlug,
  storeName,
  logoUrl,
  currency,
  pageId,
  pageTitle,
  pageSlug,
  isHomepage,
  initialData,
  hasPublished,
  initialThemeConfig,
  initialLayoutConfig,
  subscriptionPlan,
  customCss,
}: PageEditorClientProps) {
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const latestDataRef = useRef<PuckPageData | null>(initialData);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  // Key to force re-mount Puck when data changes externally (restore/template)
  const [puckKey, setPuckKey] = useState(0);
  const [currentData, setCurrentData] = useState<PuckPageData | null>(
    initialData
  );
  // Show template selector on first load with empty content
  const [showTemplates, setShowTemplates] = useState(
    !initialData || initialData.content.length === 0
  );
  // Track unsaved changes for navigation warning
  const hasUnsavedChanges = useRef(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const router = useRouter();

  // Check for small screens
  useEffect(() => {
    const check = () => setIsSmallScreen(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Track latest data via onChange
  const handleChange = useCallback((data: PuckPageData) => {
    latestDataRef.current = data;
    hasUnsavedChanges.current = true;
  }, []);

  // Save draft
  const handleSaveDraft = useCallback(async () => {
    if (!latestDataRef.current || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await savePageLayoutDraft(
        tenantId,
        pageId,
        latestDataRef.current
      );
      if (result.success) {
        setLastSaved(new Date());
        hasUnsavedChanges.current = false;
      } else {
        setSaveError(result.error || "Failed to save");
      }
    } catch {
      setSaveError("Failed to save draft");
    } finally {
      setSaving(false);
    }
  }, [tenantId, pageId, saving]);

  // Publish
  const handlePublish = useCallback(
    async (data: PuckPageData) => {
      setPublishing(true);
      setSaveError(null);
      try {
        const result = await publishPageLayout(tenantId, pageId, data);
        if (result.success) {
          setLastSaved(new Date());
          hasUnsavedChanges.current = false;
        } else {
          setSaveError(result.error || "Failed to publish");
        }
      } catch {
        setSaveError("Failed to publish");
      } finally {
        setPublishing(false);
      }
    },
    [tenantId, pageId]
  );

  // Revert to published
  const handleRevert = useCallback(async () => {
    if (reverting) return;
    if (
      !confirm("Revert draft to last published version? This cannot be undone.")
    )
      return;
    setReverting(true);
    try {
      const result = await revertToPublished(tenantId, pageId);
      if (result.success) {
        window.location.reload();
      } else {
        setSaveError(result.error || "Failed to revert");
      }
    } catch {
      setSaveError("Failed to revert");
    } finally {
      setReverting(false);
    }
  }, [tenantId, pageId, reverting]);

  // Handle version restore from history panel
  const handleVersionRestore = useCallback((data: PuckPageData) => {
    setCurrentData(data);
    latestDataRef.current = data;
    setPuckKey((k) => k + 1);
  }, []);

  // Handle template selection
  const handleTemplateSelect = useCallback((data: PuckPageData) => {
    setCurrentData(data);
    latestDataRef.current = data;
    setPuckKey((k) => k + 1);
    setShowTemplates(false);
  }, []);

  // Keyboard shortcut: Ctrl+S for save draft
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveDraft();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSaveDraft]);

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Small screen warning
  if (isSmallScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-6">
        <div className="max-w-sm text-center">
          <h2 className="mb-2 text-lg font-semibold">Desktop Required</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            The page editor requires a screen width of at least 768px. Please
            use a desktop or laptop to customize your store.
          </p>
          <Link
            href={`/dashboard/${storeSlug}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="size-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const defaultData: PuckPageData = {
    root: { props: {} },
    content: [],
  };

  // Migrate old marker-prop sections to new full-config format
  const editorData = migratePageData(
    currentData || defaultData,
    initialLayoutConfig
  );

  const dashboardUrl = `/dashboard/${storeSlug}/customize`;
  const storeUrl = isHomepage
    ? `/store/${storeSlug}`
    : `/store/${storeSlug}/page/${pageSlug}`;

  return (
    <DesignProvider initialTheme={initialThemeConfig}>
      <EditorProvider
        value={{ tenantId, storeSlug, storeName, logoUrl, currency }}
      >
        <div className="fixed inset-0 z-50 bg-background">
          {/* Template selector overlay */}
          {showTemplates && (
            <TemplateSelector
              onSelect={handleTemplateSelect}
              onClose={() => setShowTemplates(false)}
              hasExistingContent={(currentData?.content?.length ?? 0) > 0}
            />
          )}

          <KeyboardShortcutsDialog />

          {/* Leave confirmation dialog */}
          <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Leave editor?</AlertDialogTitle>
                <AlertDialogDescription>
                  You have unsaved changes that will be lost if you leave
                  without saving.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep editing</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => router.push(dashboardUrl)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Leave without saving
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Puck
            key={puckKey}
            config={puckConfig}
            data={editorData}
            metadata={{ tenantId, storeSlug, currency }}
            iframe={{ enabled: true }}
            viewports={[
              {
                width: 360,
                label: "Mobile",
                icon: <Smartphone className="size-4" />,
              },
              {
                width: 768,
                label: "Tablet",
                icon: <Tablet className="size-4" />,
              },
              {
                width: 1280,
                label: "Desktop",
                icon: <Monitor className="size-4" />,
              },
            ]}
            onChange={handleChange as (data: unknown) => void}
            onPublish={handlePublish as (data: unknown) => void}
            overrides={{
              drawerItem: ({ children, name }) => {
                const Icon = sectionIconMap[name];
                const Thumbnail = sectionThumbnails[name];
                return (
                  <div className="flex flex-col gap-1.5 w-full">
                    {/* Thumbnail preview */}
                    <div className="w-full h-14 rounded-md overflow-hidden border bg-muted/40 flex items-center justify-center">
                      {Thumbnail ? (
                        <div className="w-full h-full">{Thumbnail}</div>
                      ) : (
                        Icon && <Icon className="size-5 text-muted-foreground" />
                      )}
                    </div>
                    {/* Section name */}
                    <div className="flex items-center gap-1.5 text-xs">
                      {Icon && <Icon className="size-3 shrink-0 text-muted-foreground" />}
                      <span className="truncate">{children}</span>
                    </div>
                  </div>
                );
              },
              header: ({ children }) => (
                <div className="flex h-[53px] items-center border-b bg-background px-2">
                  {/* Back to dashboard — Shopify-style exit button */}
                  <button
                    onClick={() => {
                      if (hasUnsavedChanges.current) {
                        setShowLeaveDialog(true);
                      } else {
                        router.push(dashboardUrl);
                      }
                    }}
                    className="group inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-foreground/70 transition-all hover:bg-accent hover:text-foreground"
                    title="Back to dashboard"
                    aria-label="Exit"
                  >
                    <ArrowLeft className="size-4.5 transition-transform group-hover:-translate-x-0.5" />
                    <span className="relative overflow-hidden text-sm font-medium">
                      {/* Store name — slides out on hover */}
                      <span className="inline-block transition-all duration-200 group-hover:-translate-y-full group-hover:opacity-0">
                        {pageTitle}
                      </span>
                      {/* "Exit" — slides in on hover */}
                      <span className="absolute inset-0 inline-block translate-y-full opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                        Exit
                      </span>
                    </span>
                  </button>

                  <div className="flex-1" />

                  {/* Puck header children — hidden, kept in DOM for framework internals */}
                  <div className="sr-only">{children}</div>

                  {/* Canvas toolbar (fixed over canvas via position measurement) */}
                  <CanvasToolbar />

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {/* Status indicator */}
                    {saveError && (
                      <span className="mr-1 text-xs text-destructive">
                        {saveError}
                      </span>
                    )}
                    {lastSaved && !saveError && (
                      <span className="mr-1 text-xs text-muted-foreground">
                        Saved {lastSaved.toLocaleTimeString()}
                      </span>
                    )}

                    {/* Undo / Redo */}
                    <UndoRedoButtons />

                    <div className="mx-1 h-5 w-px bg-border" />

                    {/* Tool buttons — icon-only */}
                    <DesignPanel
                      storeId={tenantId}
                      storeSlug={storeSlug}
                      isPro={subscriptionPlan === "pro"}
                      initialCustomCss={customCss}
                    />

                    <button
                      onClick={() => setShowTemplates(true)}
                      className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      title="Browse templates"
                    >
                      <LayoutTemplate className="size-4" />
                    </button>

                    <VersionHistoryPanel
                      tenantId={tenantId}
                      pageId={pageId}
                      onRestore={handleVersionRestore}
                    />

                    <a
                      href={storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      title="Preview store"
                    >
                      <Eye className="size-4" />
                    </a>

                    {hasPublished && (
                      <button
                        onClick={handleRevert}
                        disabled={reverting}
                        className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-30"
                        title="Revert to published version"
                      >
                        {reverting ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Undo2 className="size-4" />
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => {
                        window.dispatchEvent(
                          new KeyboardEvent("keydown", { key: "?" })
                        );
                      }}
                      className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      title="Keyboard shortcuts (?)"
                    >
                      <Keyboard className="size-4" />
                    </button>

                    <div className="mx-1 h-5 w-px bg-border" />

                    {/* Save & Publish */}
                    <button
                      onClick={handleSaveDraft}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Save className="size-3.5" />
                      )}
                      Save
                    </button>

                    <button
                      onClick={() => {
                        if (latestDataRef.current) {
                          handlePublish(latestDataRef.current);
                        }
                      }}
                      disabled={publishing}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      {publishing ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Globe className="size-3.5" />
                      )}
                      Publish
                    </button>
                  </div>
                </div>
              ),
            }}
            headerTitle={`Edit: ${pageTitle}`}
          />
        </div>
      </EditorProvider>
    </DesignProvider>
  );
}
