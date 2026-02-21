export { SpacerSection } from "./spacer-section";
export { RichTextSection } from "./rich-text-section";
export { HeroBanner } from "./hero-banner";
export { FeaturedCategoriesSection } from "./featured-categories";
export { ProductGridSection } from "./product-grid-section";
export { ProductSpotlightSection } from "./product-spotlight";
export { AnnouncementBar } from "./announcement-bar";
export { ImageGallerySection } from "./image-gallery";
export { TestimonialsSection } from "./testimonials-section";
export { CollectionTabs } from "./collection-tabs";
export { VideoHero } from "./video-hero";
export { ProductCarouselSection } from "./product-carousel";
export { MarqueeBar } from "./marquee-bar";
export { ContentCardsSection } from "./content-cards";
// BentoGridSection is intentionally NOT re-exported here because it imports
// DropZone from @puckeditor/core. The storefront renderer (RSC) must not
// pull in any Puck client JS. Import BentoGridSection directly where needed
// (e.g., lib/page-builder/config.ts).
