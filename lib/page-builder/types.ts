import type { Data } from "@puckeditor/core";

// Re-export Puck's Data type
export type PuckPageData = Data;

// ============================================================================
// SHARED TYPES
// ============================================================================

export type CTAButton = {
  text: string;
  href: string;
  style: "primary" | "secondary" | "outline";
};

// ============================================================================
// SECTION PROP TYPES
// ============================================================================

export type HeroBannerProps = {
  imageUrl: string;
  mobileImageUrl: string;
  imageAlt: string;
  title: string;
  subtitle: string;
  headingSize: "md" | "lg" | "xl" | "2xl";
  ctaButtons: CTAButton[];
  overlayOpacity: number; // 0-100
  textAlignment: "left" | "center" | "right";
  contentPosition:
    | "center"
    | "left"
    | "right"
    | "bottom-left"
    | "bottom-center";
  minHeight: "small" | "medium" | "large" | "full";
  // Legacy fields — kept for backward-compat data migration only; not in editor config
  ctaText?: string;
  ctaLink?: string;
};

export type FeaturedCategoriesProps = {
  title: string;
  categoryIds: string[];
  layout: "grid" | "scroll" | "bento";
  columns: number; // 2, 3, or 4
  showProductCount: boolean;
};

export type ProductGridProps = {
  title: string;
  source: "all" | "manual" | "category" | "newest" | "on_sale";
  productIds: string[];
  categoryId: string;
  limit: number;
  columns: number; // 2, 3, or 4
  showViewAll: boolean;
  cardStyle: "standard" | "minimal" | "overlay";
  imageAspectRatio: "square" | "portrait" | "landscape";
  showPrice: boolean;
  showBadge: boolean;
  cardBorderRadius: "none" | "sm" | "md" | "lg";
  cardShadow: "none" | "sm" | "md" | "lg";
  hoverEffect: "none" | "lift" | "scale" | "glow";
  textAlign: "left" | "center";
};

export type ProductSpotlightProps = {
  productId: string;
  layout: "image_left" | "image_right";
  showDescription: boolean;
  showPrice: boolean;
  ctaText: string;
  backgroundColor: string;
};

export type RichTextProps = {
  content: string; // TipTap HTML
  maxWidth: "narrow" | "medium" | "full";
  padding: "none" | "small" | "medium" | "large";
};

export type SpacerProps = {
  height: "xs" | "sm" | "md" | "lg" | "xl";
};

export type AnnouncementBarProps = {
  text: string;
  linkText: string;
  linkUrl: string;
  backgroundColor: string;
  textColor: string;
  dismissible: boolean;
  icon: "none" | "megaphone" | "tag" | "sparkles" | "truck";
};

export type ImageGalleryProps = {
  title: string;
  images: Array<{ url: string; alt: string; linkUrl?: string }>;
  layout: "grid" | "masonry" | "carousel";
  columns: 2 | 3 | 4;
  gap: "none" | "sm" | "md" | "lg";
  aspectRatio: "square" | "landscape" | "portrait" | "auto";
};

export type TestimonialsProps = {
  title: string;
  subtitle: string;
  testimonials: Array<{
    quote: string;
    authorName: string;
    authorRole: string;
    authorImageUrl: string;
    rating: number; // 1-5
  }>;
  layout: "carousel" | "grid" | "stacked";
  columns: 2 | 3;
  showRating: boolean;
  backgroundColor: string;
};

export type BentoGridProps = {
  title: string;
  gridTemplate: "2x2" | "1-2" | "2-1" | "featured-left" | "featured-right";
  gap: "none" | "sm" | "md" | "lg";
  minHeight: "small" | "medium" | "large";
};

// ============================================================================
// STORE HEADER / FOOTER (full config lives in Puck props)
// ============================================================================

import type { HeaderConfig, FooterConfig } from "@/lib/theme/layout-types";

export type StoreHeaderSectionProps = { config: HeaderConfig };
export type StoreFooterSectionProps = { config: FooterConfig };

// ============================================================================
// RENDER CONTEXT
// ============================================================================

/** Context passed to storefront section renderers for data fetching */
export type SectionRenderContext = {
  tenantId: string;
  storeSlug: string;
  currency: string;
  catalogMode: boolean;
  basePath: string;
};

// ============================================================================
// RESOLVED DATA TYPES (passed to sections after data fetching)
// ============================================================================

export type ResolvedCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  productCount: number;
};

export type ResolvedProduct = {
  id: string;
  name: string;
  slug: string;
  price: string;
  compareAtPrice: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  secondImageUrl?: string | null;
  hasVariants: boolean;
  minVariantPrice?: string;
  maxVariantPrice?: string;
};

// ============================================================================
// ENTERPRISE SECTION PROP TYPES (Phase 2)
// ============================================================================

export type VideoHeroProps = {
  mediaType: "image" | "video";
  imageUrl: string;
  mobileImageUrl: string;
  videoUrl: string;
  mobileVideoUrl: string;
  videoPosterUrl: string;
  mobileVideoPosterUrl: string;
  autoplay: boolean;
  loop: boolean;
  muted: boolean;
  overlayOpacity: number;
  overlayColor: string;
  heading: string;
  subheading: string;
  headingSize: "md" | "lg" | "xl" | "2xl";
  textAlign: "left" | "center" | "right";
  textColor: "light" | "dark";
  overlayImageUrl: string;
  ctaButtons: CTAButton[];
  height: "sm" | "md" | "lg" | "full";
  contentPosition:
    | "left"
    | "center"
    | "right"
    | "bottom-left"
    | "bottom-center";
};

export type ProductCarouselProps = {
  heading: string;
  subtitle: string;
  source: "newest" | "all" | "manual" | "category" | "on_sale";
  productIds: string[];
  categoryId: string;
  limit: number;
  showViewAll: boolean;
  viewAllUrl: string;
  slidesPerView: "2" | "3" | "4";
  showArrows: boolean;
  cardStyle: "standard" | "compact" | "minimal";
  backgroundColor: string;
  textColor: "light" | "dark";
};

export type CollectionTabCard = {
  imageUrl: string;
  mobileImageUrl: string;
  title: string;
  subtitle: string;
  href: string;
  aspectRatio: "4/5" | "3/4" | "1/1" | "16/9";
};

export type CollectionTab = {
  label: string;
  cards: CollectionTabCard[];
};

export type CollectionTabsProps = {
  heading: string;
  tabs: CollectionTab[];
  layout: "grid" | "carousel";
  columns: "2" | "3" | "4";
  cardStyle: "overlay" | "below";
  gap: "sm" | "md" | "lg";
  backgroundColor: string;
};

export type MarqueeItem = {
  text: string;
  icon:
    | "truck"
    | "refresh"
    | "clock"
    | "shield"
    | "star"
    | "gift"
    | "tag"
    | "heart"
    | "none";
  href: string;
};

export type MarqueeBarProps = {
  items: MarqueeItem[];
  speed: "slow" | "normal" | "fast";
  direction: "left" | "right";
  backgroundColor: string;
  textColor: string;
  pauseOnHover: boolean;
  fontSize: "xs" | "sm" | "md";
  separator: "dot" | "pipe" | "star" | "none";
};

export type ContentCard = {
  imageUrl: string;
  mobileImageUrl: string;
  title: string;
  subtitle: string;
  href: string;
  ctaText: string;
  aspectRatio: "4/5" | "3/4" | "1/1" | "16/9";
};

export type ContentCardsProps = {
  heading: string;
  cards: ContentCard[];
  layout: "grid" | "carousel";
  columns: "2" | "3" | "4";
  gap: "none" | "sm" | "md" | "lg";
  cardStyle: "overlay-bottom" | "overlay-center" | "below";
  overlayGradient: boolean;
  backgroundColor: string;
};
