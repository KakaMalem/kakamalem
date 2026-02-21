import {
  HeroBanner,
  FeaturedCategoriesSection,
  ProductGridSection,
  ProductSpotlightSection,
  RichTextSection,
  SpacerSection,
  ImageGallerySection,
  TestimonialsSection,
} from "./sections";
import { AnnouncementBarStatic } from "./sections/announcement-bar";
import { VideoHero } from "./sections/video-hero";
import { ProductCarouselSection } from "./sections/product-carousel";
import { CollectionTabs } from "./sections/collection-tabs";
import { MarqueeBar } from "./sections/marquee-bar";
import { ContentCardsSection } from "./sections/content-cards";
import { SectionTracker } from "./section-tracker";
import { getCategoriesByIds } from "@/lib/db/queries/page-layouts";
import {
  fetchProductsForGrid,
  getProductsByIds,
} from "@/lib/page-builder/resolve-products";
import type {
  PuckPageData,
  SectionRenderContext,
  ProductGridProps,
  ProductCarouselProps,
  ResolvedProduct,
  AnnouncementBarProps,
  ImageGalleryProps,
  TestimonialsProps,
  BentoGridProps,
  VideoHeroProps,
  MarqueeBarProps,
  ContentCardsProps,
  CollectionTabsProps,
  CTAButton,
} from "@/lib/page-builder/types";

/**
 * Server-side storefront renderer for Puck page data.
 *
 * CRITICAL: This component does NOT import @puckeditor/core.
 * It manually iterates the Puck content array and renders RSC sections.
 * This guarantees zero Puck JS ships to visitors.
 */
export async function StorefrontRenderer({
  data,
  context,
}: {
  data: PuckPageData;
  context: SectionRenderContext;
}) {
  if (!data?.content || data.content.length === 0) {
    return null;
  }

  // Collect all data-fetching needs from all sections, then batch
  const productIdSets: string[][] = [];
  const categoryIdSets: string[][] = [];
  const productGridConfigs: Array<{
    index: number;
    props: ProductGridProps;
  }> = [];
  const spotlightProductIds: string[] = [];

  for (let i = 0; i < data.content.length; i++) {
    const item = data.content[i];
    const props = item.props as Record<string, unknown>;

    switch (item.type) {
      case "FeaturedCategories": {
        const ids = props.categoryIds as string[] | undefined;
        if (ids && ids.length > 0) {
          categoryIdSets.push(ids);
        }
        break;
      }
      case "ProductGrid": {
        const source = (props.source as string) || "newest";
        if (source === "manual") {
          const ids = props.productIds as string[] | undefined;
          if (ids && ids.length > 0) {
            productIdSets.push(ids);
          }
        }
        productGridConfigs.push({
          index: i,
          props: props as unknown as ProductGridProps,
        });
        break;
      }
      case "ProductCarousel": {
        const source = (props.source as string) || "newest";
        if (source === "manual") {
          const ids = props.productIds as string[] | undefined;
          if (ids && ids.length > 0) {
            productIdSets.push(ids);
          }
        }
        productGridConfigs.push({
          index: i,
          props: props as unknown as ProductGridProps,
        });
        break;
      }
      case "ProductSpotlight": {
        const id = props.productId as string | undefined;
        if (id) {
          spotlightProductIds.push(id);
        }
        break;
      }
    }
  }

  // Batch-fetch all needed data in parallel
  const allManualProductIds = [...new Set(productIdSets.flat())];
  const allCategoryIds = [...new Set(categoryIdSets.flat())];
  const allSpotlightIds = [...new Set(spotlightProductIds)];

  // Build parallel fetch promises
  const fetchPromises: Promise<unknown>[] = [];

  // 0: Manual product IDs
  fetchPromises.push(
    allManualProductIds.length > 0
      ? getProductsByIds(context.tenantId, allManualProductIds)
      : Promise.resolve([])
  );

  // 1: Category IDs
  fetchPromises.push(
    allCategoryIds.length > 0
      ? getCategoriesByIds(context.tenantId, allCategoryIds)
      : Promise.resolve([])
  );

  // 2: Spotlight product IDs
  fetchPromises.push(
    allSpotlightIds.length > 0
      ? getProductsByIds(context.tenantId, allSpotlightIds)
      : Promise.resolve([])
  );

  // 3+: Dynamic product grid fetches (for non-manual sources)
  const gridFetchIndices: Map<number, number> = new Map(); // grid config index → fetchPromises index
  for (const config of productGridConfigs) {
    const { props } = config;
    if (props.source !== "manual") {
      const fetchIndex = fetchPromises.length;
      gridFetchIndices.set(config.index, fetchIndex);
      fetchPromises.push(fetchProductsForGrid(context.tenantId, props));
    }
  }

  const results = await Promise.all(fetchPromises);

  const manualProducts = results[0] as ResolvedProduct[];
  const resolvedCategories = results[1] as Awaited<
    ReturnType<typeof getCategoriesByIds>
  >;
  const spotlightProducts = results[2] as ResolvedProduct[];

  // Build lookup maps
  const manualProductMap = new Map(manualProducts.map((p) => [p.id, p]));
  const categoryMap = new Map(resolvedCategories.map((c) => [c.id, c]));
  const spotlightMap = new Map(spotlightProducts.map((p) => [p.id, p]));

  // Pre-compute the index of the first HeroBanner for LCP priority
  const firstHeroBannerIndex = data.content.findIndex(
    (item) => item.type === "HeroBanner"
  );
  const firstVideoHeroIndex = data.content.findIndex(
    (item) => item.type === "VideoHero"
  );

  // Render each section
  const sections = data.content.map((item, i) => {
    const props = item.props as Record<string, unknown>;
    const key = (props.id as string) || `section-${i}`;

    // Wrap in a div with data attributes for section analytics tracking
    const wrapSection = (node: React.ReactNode) => (
      <div key={key} data-section-type={item.type} data-section-index={i}>
        {node}
      </div>
    );

    switch (item.type) {
      case "HeroBanner": {
        const isFirst = i === firstHeroBannerIndex;
        return wrapSection(
          <HeroBanner
            imageUrl={(props.imageUrl as string) || ""}
            mobileImageUrl={(props.mobileImageUrl as string) || ""}
            imageAlt={(props.imageAlt as string) || ""}
            title={(props.title as string) || ""}
            subtitle={(props.subtitle as string) || ""}
            headingSize={
              (props.headingSize as "md" | "lg" | "xl" | "2xl") || "xl"
            }
            ctaText={(props.ctaText as string) || ""}
            ctaLink={(props.ctaLink as string) || ""}
            ctaButtons={(props.ctaButtons as CTAButton[]) || []}
            overlayOpacity={(props.overlayOpacity as number) ?? 40}
            textAlignment={
              (props.textAlignment as "left" | "center" | "right") || "center"
            }
            contentPosition={
              (props.contentPosition as
                | "center"
                | "left"
                | "right"
                | "bottom-left"
                | "bottom-center") || "center"
            }
            minHeight={
              (props.minHeight as "small" | "medium" | "large" | "full") ||
              "medium"
            }
            priority={isFirst}
            basePath={context.basePath}
          />
        );
      }

      case "FeaturedCategories": {
        const ids = (props.categoryIds as string[]) || [];
        const cats = ids
          .map((id) => categoryMap.get(id))
          .filter((c): c is NonNullable<typeof c> => c != null);
        return wrapSection(
          <FeaturedCategoriesSection
            title={(props.title as string) || ""}
            categoryIds={ids}
            layout={(props.layout as "grid" | "scroll" | "bento") || "grid"}
            columns={(props.columns as number) || 3}
            showProductCount={(props.showProductCount as boolean) ?? true}
            resolvedCategories={cats}
            basePath={context.basePath}
          />
        );
      }

      case "ProductGrid": {
        const source = (props.source as string) || "newest";
        let products: ResolvedProduct[] = [];

        if (source === "manual") {
          const ids = (props.productIds as string[]) || [];
          products = ids
            .map((id) => manualProductMap.get(id))
            .filter((p): p is ResolvedProduct => p != null);
        } else {
          const fetchIdx = gridFetchIndices.get(i);
          if (fetchIdx !== undefined) {
            products = results[fetchIdx] as ResolvedProduct[];
          }
        }

        return wrapSection(
          <ProductGridSection
            title={(props.title as string) || ""}
            source={source as ProductGridProps["source"]}
            productIds={(props.productIds as string[]) || []}
            categoryId={(props.categoryId as string) || ""}
            limit={(props.limit as number) || 8}
            columns={(props.columns as number) || 4}
            showViewAll={(props.showViewAll as boolean) ?? true}
            cardStyle={
              (props.cardStyle as "standard" | "minimal" | "overlay") ||
              "standard"
            }
            imageAspectRatio={
              (props.imageAspectRatio as "square" | "portrait" | "landscape") ||
              "square"
            }
            showPrice={(props.showPrice as boolean) ?? true}
            showBadge={(props.showBadge as boolean) ?? true}
            cardBorderRadius={
              (props.cardBorderRadius as "none" | "sm" | "md" | "lg") || "md"
            }
            cardShadow={
              (props.cardShadow as "none" | "sm" | "md" | "lg") || "sm"
            }
            hoverEffect={
              (props.hoverEffect as "none" | "lift" | "scale" | "glow") ||
              "lift"
            }
            textAlign={(props.textAlign as "left" | "center") || "left"}
            resolvedProducts={products}
            basePath={context.basePath}
            currency={context.currency}
          />
        );
      }

      case "ProductSpotlight": {
        const productId = (props.productId as string) || "";
        const product = productId
          ? (spotlightMap.get(productId) ?? null)
          : null;
        return wrapSection(
          <ProductSpotlightSection
            productId={productId}
            layout={
              (props.layout as "image_left" | "image_right") || "image_left"
            }
            showDescription={(props.showDescription as boolean) ?? true}
            showPrice={(props.showPrice as boolean) ?? true}
            ctaText={(props.ctaText as string) || "View Product"}
            backgroundColor={(props.backgroundColor as string) || ""}
            resolvedProduct={product}
            basePath={context.basePath}
            currency={context.currency}
          />
        );
      }

      case "RichText":
        return wrapSection(
          <RichTextSection
            content={(props.content as string) || ""}
            maxWidth={
              (props.maxWidth as "narrow" | "medium" | "full") || "medium"
            }
            padding={
              (props.padding as "none" | "small" | "medium" | "large") ||
              "medium"
            }
          />
        );

      case "Spacer":
        return wrapSection(
          <SpacerSection
            height={(props.height as "xs" | "sm" | "md" | "lg" | "xl") || "md"}
          />
        );

      case "AnnouncementBar":
        return wrapSection(
          <AnnouncementBarStatic
            id={key}
            text={(props.text as string) || ""}
            linkText={(props.linkText as string) || ""}
            linkUrl={(props.linkUrl as string) || ""}
            backgroundColor={(props.backgroundColor as string) || "#000000"}
            textColor={(props.textColor as string) || "#ffffff"}
            dismissible={(props.dismissible as boolean) ?? true}
            icon={(props.icon as AnnouncementBarProps["icon"]) || "none"}
            basePath={context.basePath}
          />
        );

      case "ImageGallery":
        return wrapSection(
          <ImageGallerySection
            id={key}
            basePath={context.basePath}
            title={(props.title as string) || ""}
            images={(props.images as ImageGalleryProps["images"]) || []}
            layout={(props.layout as "grid" | "masonry" | "carousel") || "grid"}
            columns={(props.columns as 2 | 3 | 4) || 3}
            gap={(props.gap as "none" | "sm" | "md" | "lg") || "md"}
            aspectRatio={
              (props.aspectRatio as
                | "square"
                | "landscape"
                | "portrait"
                | "auto") || "square"
            }
          />
        );

      case "Testimonials":
        return wrapSection(
          <TestimonialsSection
            id={key}
            title={(props.title as string) || ""}
            subtitle={(props.subtitle as string) || ""}
            testimonials={
              (props.testimonials as TestimonialsProps["testimonials"]) || []
            }
            layout={(props.layout as "carousel" | "grid" | "stacked") || "grid"}
            columns={(props.columns as 2 | 3) || 3}
            showRating={(props.showRating as boolean) ?? true}
            backgroundColor={(props.backgroundColor as string) || ""}
          />
        );

      case "BentoGrid": {
        // Render BentoGrid by iterating its zones
        const gridTemplate =
          (props.gridTemplate as BentoGridProps["gridTemplate"]) || "2x2";
        const gridGap = (props.gap as "none" | "sm" | "md" | "lg") || "md";
        const gridMinHeight =
          (props.minHeight as "small" | "medium" | "large") || "medium";
        const gapMap = { none: "0px", sm: "8px", md: "16px", lg: "24px" };
        const heightMap = { small: "300px", medium: "450px", large: "600px" };

        const gridTemplates: Record<
          string,
          { columns: string; rows: string; cells: { area: string }[] }
        > = {
          "2x2": {
            columns: "1fr 1fr",
            rows: "1fr 1fr",
            cells: [
              { area: "1/1/2/2" },
              { area: "1/2/2/3" },
              { area: "2/1/3/2" },
              { area: "2/2/3/3" },
            ],
          },
          "1-2": {
            columns: "1fr 1fr",
            rows: "2fr 1fr",
            cells: [
              { area: "1/1/2/3" },
              { area: "2/1/3/2" },
              { area: "2/2/3/3" },
            ],
          },
          "2-1": {
            columns: "1fr 1fr",
            rows: "1fr 2fr",
            cells: [
              { area: "1/1/2/2" },
              { area: "1/2/2/3" },
              { area: "2/1/3/3" },
            ],
          },
          "featured-left": {
            columns: "2fr 1fr",
            rows: "1fr 1fr",
            cells: [
              { area: "1/1/3/2" },
              { area: "1/2/2/3" },
              { area: "2/2/3/3" },
            ],
          },
          "featured-right": {
            columns: "1fr 2fr",
            rows: "1fr 1fr",
            cells: [
              { area: "1/1/2/2" },
              { area: "2/1/3/2" },
              { area: "1/2/3/3" },
            ],
          },
        };

        const template = gridTemplates[gridTemplate] || gridTemplates["2x2"];

        return wrapSection(
          <section className="py-8">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              {typeof props.title === "string" && props.title && (
                <h2 className="mb-6 text-2xl font-bold tracking-tight">
                  {props.title}
                </h2>
              )}
              <div
                className="grid"
                style={{
                  gridTemplateColumns: template.columns,
                  gridTemplateRows: template.rows,
                  gap: gapMap[gridGap],
                  minHeight: heightMap[gridMinHeight],
                }}
              >
                {template.cells.map((cell, cellIdx) => {
                  // Look up zone items from data.zones
                  const zoneKey = `BentoGrid-${key}:bento-cell-${cellIdx}`;
                  const zoneItems = data.zones?.[zoneKey] || [];

                  return (
                    <div
                      key={cellIdx}
                      className="overflow-hidden rounded-lg border bg-card"
                      style={{ gridArea: cell.area }}
                    >
                      {zoneItems.map((zoneItem, zi) => {
                        const zoneProps = zoneItem.props as Record<
                          string,
                          unknown
                        >;
                        const zoneKey2 =
                          (zoneProps.id as string) || `zone-${cellIdx}-${zi}`;
                        return renderStaticSection(
                          zoneItem.type,
                          zoneProps,
                          zoneKey2,
                          context
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        );
      }

      case "VideoHero": {
        const isFirst = i === firstVideoHeroIndex;
        return wrapSection(
          <VideoHero
            mediaType={(props.mediaType as "image" | "video") || "image"}
            imageUrl={(props.imageUrl as string) || ""}
            mobileImageUrl={(props.mobileImageUrl as string) || ""}
            videoUrl={(props.videoUrl as string) || ""}
            mobileVideoUrl={(props.mobileVideoUrl as string) || ""}
            videoPosterUrl={(props.videoPosterUrl as string) || ""}
            mobileVideoPosterUrl={(props.mobileVideoPosterUrl as string) || ""}
            autoplay={(props.autoplay as boolean) ?? true}
            loop={(props.loop as boolean) ?? true}
            muted={(props.muted as boolean) ?? true}
            overlayOpacity={(props.overlayOpacity as number) ?? 30}
            overlayColor={(props.overlayColor as string) || "#000000"}
            heading={(props.heading as string) || ""}
            subheading={(props.subheading as string) || ""}
            headingSize={
              (props.headingSize as VideoHeroProps["headingSize"]) || "xl"
            }
            textAlign={
              (props.textAlign as VideoHeroProps["textAlign"]) || "center"
            }
            textColor={(props.textColor as "light" | "dark") || "light"}
            overlayImageUrl={(props.overlayImageUrl as string) || ""}
            ctaButtons={(props.ctaButtons as CTAButton[]) || []}
            height={(props.height as VideoHeroProps["height"]) || "lg"}
            contentPosition={
              (props.contentPosition as VideoHeroProps["contentPosition"]) ||
              "center"
            }
            priority={isFirst}
            basePath={context.basePath}
          />
        );
      }

      case "ProductCarousel": {
        const source = (props.source as string) || "newest";
        let products: ResolvedProduct[] = [];

        if (source === "manual") {
          const ids = (props.productIds as string[]) || [];
          products = ids
            .map((id) => manualProductMap.get(id))
            .filter((p): p is ResolvedProduct => p != null);
        } else {
          const fetchIdx = gridFetchIndices.get(i);
          if (fetchIdx !== undefined) {
            products = results[fetchIdx] as ResolvedProduct[];
          }
        }

        return wrapSection(
          <ProductCarouselSection
            heading={(props.heading as string) || ""}
            subtitle={(props.subtitle as string) || ""}
            source={source as ProductCarouselProps["source"]}
            productIds={(props.productIds as string[]) || []}
            categoryId={(props.categoryId as string) || ""}
            limit={(props.limit as number) || 8}
            showViewAll={(props.showViewAll as boolean) ?? true}
            viewAllUrl={(props.viewAllUrl as string) || ""}
            slidesPerView={(props.slidesPerView as "2" | "3" | "4") || "4"}
            showArrows={(props.showArrows as boolean) ?? true}
            cardStyle={
              (props.cardStyle as "standard" | "compact" | "minimal") ||
              "standard"
            }
            backgroundColor={(props.backgroundColor as string) || ""}
            textColor={(props.textColor as "light" | "dark") || "dark"}
            resolvedProducts={products}
            basePath={context.basePath}
            currency={context.currency}
          />
        );
      }

      case "CollectionTabs":
        return wrapSection(
          <CollectionTabs
            heading={(props.heading as string) || ""}
            tabs={(props.tabs as CollectionTabsProps["tabs"]) || []}
            layout={(props.layout as "grid" | "carousel") || "grid"}
            columns={(props.columns as "2" | "3" | "4") || "4"}
            cardStyle={(props.cardStyle as "overlay" | "below") || "overlay"}
            gap={(props.gap as "sm" | "md" | "lg") || "md"}
            backgroundColor={(props.backgroundColor as string) || ""}
            basePath={context.basePath}
          />
        );

      case "MarqueeBar":
        return wrapSection(
          <MarqueeBar
            items={(props.items as MarqueeBarProps["items"]) || []}
            speed={(props.speed as MarqueeBarProps["speed"]) || "normal"}
            direction={(props.direction as "left" | "right") || "left"}
            backgroundColor={(props.backgroundColor as string) || "#000000"}
            textColor={(props.textColor as string) || "#ffffff"}
            pauseOnHover={(props.pauseOnHover as boolean) ?? true}
            fontSize={(props.fontSize as "xs" | "sm" | "md") || "sm"}
            separator={
              (props.separator as MarqueeBarProps["separator"]) || "dot"
            }
            basePath={context.basePath}
          />
        );

      case "ContentCards":
        return wrapSection(
          <ContentCardsSection
            heading={(props.heading as string) || ""}
            cards={(props.cards as ContentCardsProps["cards"]) || []}
            layout={(props.layout as "grid" | "carousel") || "grid"}
            columns={(props.columns as "2" | "3" | "4") || "3"}
            gap={(props.gap as "none" | "sm" | "md" | "lg") || "md"}
            cardStyle={
              (props.cardStyle as ContentCardsProps["cardStyle"]) ||
              "overlay-bottom"
            }
            overlayGradient={(props.overlayGradient as boolean) ?? true}
            backgroundColor={(props.backgroundColor as string) || ""}
          />
        );

      // Pinned sections — handled by layout, not page data
      case "StoreHeader":
      case "StoreFooter":
        return null;

      default:
        // Unknown section type — skip silently
        return null;
    }
  });

  return (
    <>
      {sections}
      <SectionTracker tenantId={context.tenantId} pageType="homepage" />
    </>
  );
}

/**
 * Render a single section statically (for BentoGrid zone content).
 * Simplified version without data fetching — only renders static sections.
 */
function renderStaticSection(
  type: string,
  props: Record<string, unknown>,
  key: string,
  context: SectionRenderContext
): React.ReactNode {
  switch (type) {
    case "HeroBanner":
      return (
        <HeroBanner
          key={key}
          imageUrl={(props.imageUrl as string) || ""}
          mobileImageUrl={(props.mobileImageUrl as string) || ""}
          imageAlt={(props.imageAlt as string) || ""}
          title={(props.title as string) || ""}
          subtitle={(props.subtitle as string) || ""}
          headingSize={
            (props.headingSize as "md" | "lg" | "xl" | "2xl") || "xl"
          }
          ctaText={(props.ctaText as string) || ""}
          ctaLink={(props.ctaLink as string) || ""}
          ctaButtons={(props.ctaButtons as CTAButton[]) || []}
          overlayOpacity={(props.overlayOpacity as number) ?? 40}
          textAlignment={
            (props.textAlignment as "left" | "center" | "right") || "center"
          }
          contentPosition={
            (props.contentPosition as
              | "center"
              | "left"
              | "right"
              | "bottom-left"
              | "bottom-center") || "center"
          }
          minHeight={
            (props.minHeight as "small" | "medium" | "large" | "full") ||
            "medium"
          }
          basePath={context.basePath}
        />
      );
    case "RichText":
      return (
        <RichTextSection
          key={key}
          content={(props.content as string) || ""}
          maxWidth={
            (props.maxWidth as "narrow" | "medium" | "full") || "medium"
          }
          padding={
            (props.padding as "none" | "small" | "medium" | "large") || "medium"
          }
        />
      );
    case "ImageGallery":
      return (
        <ImageGallerySection
          key={key}
          id={key}
          basePath={context.basePath}
          title={(props.title as string) || ""}
          images={(props.images as ImageGalleryProps["images"]) || []}
          layout={(props.layout as "grid" | "masonry" | "carousel") || "grid"}
          columns={(props.columns as 2 | 3 | 4) || 3}
          gap={(props.gap as "none" | "sm" | "md" | "lg") || "md"}
          aspectRatio={
            (props.aspectRatio as
              | "square"
              | "landscape"
              | "portrait"
              | "auto") || "square"
          }
        />
      );
    case "Spacer":
      return (
        <SpacerSection
          key={key}
          height={(props.height as "xs" | "sm" | "md" | "lg" | "xl") || "md"}
        />
      );
    case "VideoHero":
      return (
        <VideoHero
          key={key}
          mediaType={(props.mediaType as "image" | "video") || "image"}
          imageUrl={(props.imageUrl as string) || ""}
          mobileImageUrl={(props.mobileImageUrl as string) || ""}
          videoUrl={(props.videoUrl as string) || ""}
          mobileVideoUrl={(props.mobileVideoUrl as string) || ""}
          videoPosterUrl={(props.videoPosterUrl as string) || ""}
          mobileVideoPosterUrl={(props.mobileVideoPosterUrl as string) || ""}
          autoplay={(props.autoplay as boolean) ?? true}
          loop={(props.loop as boolean) ?? true}
          muted={(props.muted as boolean) ?? true}
          overlayOpacity={(props.overlayOpacity as number) ?? 30}
          overlayColor={(props.overlayColor as string) || "#000000"}
          heading={(props.heading as string) || ""}
          subheading={(props.subheading as string) || ""}
          headingSize={
            (props.headingSize as VideoHeroProps["headingSize"]) || "xl"
          }
          textAlign={
            (props.textAlign as VideoHeroProps["textAlign"]) || "center"
          }
          textColor={(props.textColor as "light" | "dark") || "light"}
          overlayImageUrl={(props.overlayImageUrl as string) || ""}
          ctaButtons={(props.ctaButtons as CTAButton[]) || []}
          height={(props.height as VideoHeroProps["height"]) || "lg"}
          contentPosition={
            (props.contentPosition as VideoHeroProps["contentPosition"]) ||
            "center"
          }
          basePath={context.basePath}
        />
      );
    case "MarqueeBar":
      return (
        <MarqueeBar
          key={key}
          items={(props.items as MarqueeBarProps["items"]) || []}
          speed={(props.speed as MarqueeBarProps["speed"]) || "normal"}
          direction={(props.direction as "left" | "right") || "left"}
          backgroundColor={(props.backgroundColor as string) || "#000000"}
          textColor={(props.textColor as string) || "#ffffff"}
          pauseOnHover={(props.pauseOnHover as boolean) ?? true}
          fontSize={(props.fontSize as "xs" | "sm" | "md") || "sm"}
          separator={(props.separator as MarqueeBarProps["separator"]) || "dot"}
          basePath={context.basePath}
        />
      );
    case "ContentCards":
      return (
        <ContentCardsSection
          key={key}
          heading={(props.heading as string) || ""}
          cards={(props.cards as ContentCardsProps["cards"]) || []}
          layout={(props.layout as "grid" | "carousel") || "grid"}
          columns={(props.columns as "2" | "3" | "4") || "3"}
          gap={(props.gap as "none" | "sm" | "md" | "lg") || "md"}
          cardStyle={
            (props.cardStyle as ContentCardsProps["cardStyle"]) ||
            "overlay-bottom"
          }
          overlayGradient={(props.overlayGradient as boolean) ?? true}
          backgroundColor={(props.backgroundColor as string) || ""}
        />
      );
    case "CollectionTabs":
      return (
        <CollectionTabs
          key={key}
          heading={(props.heading as string) || ""}
          tabs={(props.tabs as CollectionTabsProps["tabs"]) || []}
          layout={(props.layout as "grid" | "carousel") || "grid"}
          columns={(props.columns as "2" | "3" | "4") || "4"}
          cardStyle={(props.cardStyle as "overlay" | "below") || "overlay"}
          gap={(props.gap as "sm" | "md" | "lg") || "md"}
          backgroundColor={(props.backgroundColor as string) || ""}
          basePath={context.basePath}
        />
      );
    default:
      return null;
  }
}
