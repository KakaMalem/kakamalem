import type { Config, ComponentConfig } from "@puckeditor/core";
import { HeroBanner } from "@/components/page-builder/sections/hero-banner";
import { FeaturedCategoriesSection } from "@/components/page-builder/sections/featured-categories";
import { ProductGridSection } from "@/components/page-builder/sections/product-grid-section";
import { ProductSpotlightSection } from "@/components/page-builder/sections/product-spotlight";
import { RichTextSection } from "@/components/page-builder/sections/rich-text-section";
import { SpacerSection } from "@/components/page-builder/sections/spacer-section";
import { AnnouncementBar } from "@/components/page-builder/sections/announcement-bar";
import { ImageGallerySection } from "@/components/page-builder/sections/image-gallery";
import { TestimonialsSection } from "@/components/page-builder/sections/testimonials-section";
import { BentoGridSection } from "@/components/page-builder/sections/bento-grid-section";
import { StoreHeaderPreview } from "@/components/page-builder/sections/store-header-preview";
import { StoreFooterPreview } from "@/components/page-builder/sections/store-footer-preview";
import { VideoHero } from "@/components/page-builder/sections/video-hero";
import { ProductCarouselSection } from "@/components/page-builder/sections/product-carousel";
import { CollectionTabs } from "@/components/page-builder/sections/collection-tabs";
import { MarqueeBar } from "@/components/page-builder/sections/marquee-bar";
import { ContentCardsSection } from "@/components/page-builder/sections/content-cards";
import { ImagePickerFieldRender } from "@/components/page-builder/fields/image-picker-field";
import {
  SingleProductPickerRender,
  MultiProductPickerRender,
} from "@/components/page-builder/fields/product-picker-field";
import { CategoryPickerFieldRender } from "@/components/page-builder/fields/category-picker-field";
import { ColorFieldRender } from "@/components/page-builder/fields/color-field";
import { MultiImagePickerFieldRender } from "@/components/page-builder/fields/multi-image-picker-field";
import { TestimonialListFieldRender } from "@/components/page-builder/fields/testimonial-list-field";
import { HeaderSettingsFieldRender } from "@/components/page-builder/fields/header-settings-field";
import { FooterSettingsFieldRender } from "@/components/page-builder/fields/footer-settings-field";
import { CTAButtonsFieldRender } from "@/components/page-builder/fields/cta-buttons-field";
import { TabsFieldRender } from "@/components/page-builder/fields/tabs-field";
import { CardListFieldRender } from "@/components/page-builder/fields/card-list-field";
import { MarqueeItemsFieldRender } from "@/components/page-builder/fields/marquee-items-field";
import { RootRender } from "@/components/page-builder/root-renderer";
import {
  defaultHeaderConfig,
  defaultFooterConfig,
} from "@/lib/theme/layout-types";

// Type alias for Puck section render components — avoids `as any` when
// our section components have extra props injected by resolveData.
type SectionRender = ComponentConfig["render"];

// Typed helpers for resolveData callbacks
interface ResolveDataInput {
  props: Record<string, unknown>;
}
interface ResolveDataContext {
  metadata: Record<string, unknown>;
}

export const puckConfig: Config = {
  root: {
    render: RootRender as unknown as ComponentConfig["render"],
  },
  categories: {
    "Hero & Content": {
      components: ["HeroBanner", "VideoHero", "RichText"],
    },
    Products: {
      components: ["ProductGrid", "ProductCarousel", "ProductSpotlight"],
    },
    Categories: {
      components: ["FeaturedCategories", "CollectionTabs"],
    },
    Promotions: {
      components: ["AnnouncementBar", "MarqueeBar"],
    },
    "Media & Visual": {
      components: ["ImageGallery", "ContentCards"],
    },
    "Social Proof": {
      components: ["Testimonials"],
    },
    Layout: {
      components: ["BentoGrid", "Spacer"],
    },
    Structure: {
      components: ["StoreHeader", "StoreFooter"],
    },
  },
  components: {
    HeroBanner: {
      label: "Hero Banner",
      defaultProps: {
        imageUrl: "",
        mobileImageUrl: "",
        imageAlt: "",
        title: "Welcome to Our Store",
        subtitle: "Discover amazing products",
        headingSize: "xl",
        ctaButtons: [{ text: "Shop Now", href: "/products", style: "primary" }],
        overlayOpacity: 40,
        textAlignment: "center",
        contentPosition: "center",
        minHeight: "medium",
      },
      fields: {
        imageUrl: {
          type: "custom",
          label: "Background Image",
          render: ImagePickerFieldRender,
        },
        mobileImageUrl: {
          type: "custom",
          label: "Mobile Image",
          render: ImagePickerFieldRender,
        },
        imageAlt: {
          type: "text",
          label: "Image Alt Text",
        },
        title: {
          type: "text",
          label: "Heading",
        },
        subtitle: {
          type: "textarea",
          label: "Subtitle",
        },
        headingSize: {
          type: "select",
          label: "Heading Size",
          options: [
            { label: "Medium", value: "md" },
            { label: "Large", value: "lg" },
            { label: "Extra Large", value: "xl" },
            { label: "2X Large", value: "2xl" },
          ],
        },
        ctaButtons: {
          type: "custom",
          label: "Buttons",
          render: CTAButtonsFieldRender,
        },
        overlayOpacity: {
          type: "number",
          label: "Overlay Opacity (%)",
          min: 0,
          max: 100,
        },
        textAlignment: {
          type: "radio",
          label: "Text Alignment",
          options: [
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
            { label: "Right", value: "right" },
          ],
        },
        contentPosition: {
          type: "select",
          label: "Content Position",
          options: [
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
            { label: "Right", value: "right" },
            { label: "Bottom Left", value: "bottom-left" },
            { label: "Bottom Center", value: "bottom-center" },
          ],
        },
        minHeight: {
          type: "select",
          label: "Height",
          options: [
            { label: "Small (300px)", value: "small" },
            { label: "Medium (500px)", value: "medium" },
            { label: "Large (600px)", value: "large" },
            { label: "Full Screen", value: "full" },
          ],
        },
      },
      render: HeroBanner as unknown as SectionRender,
    },

    FeaturedCategories: {
      label: "Featured Categories",
      defaultProps: {
        title: "Shop by Category",
        categoryIds: [],
        layout: "grid",
        columns: 3,
        showProductCount: true,
      },
      fields: {
        title: {
          type: "text",
          label: "Section Title",
        },
        categoryIds: {
          type: "custom",
          label: "Categories",
          render: CategoryPickerFieldRender,
        },
        layout: {
          type: "radio",
          label: "Layout",
          options: [
            { label: "Grid", value: "grid" },
            { label: "Scroll", value: "scroll" },
            { label: "Bento", value: "bento" },
          ],
        },
        columns: {
          type: "select",
          label: "Columns",
          options: [
            { label: "2 Columns", value: 2 },
            { label: "3 Columns", value: 3 },
            { label: "4 Columns", value: 4 },
          ],
        },
        showProductCount: {
          type: "radio",
          label: "Product Count",
          options: [
            { label: "Show", value: true },
            { label: "Hide", value: false },
          ],
        },
      },
      resolveData: async (
        data: ResolveDataInput,
        { metadata }: ResolveDataContext
      ) => {
        const categoryIds = data.props.categoryIds as string[] | undefined;
        if (!metadata?.tenantId || !categoryIds?.length) return data;
        try {
          const res = await fetch("/api/page-builder/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tenantId: metadata.tenantId,
              type: "categories",
              params: { categoryIds: data.props.categoryIds },
            }),
          });
          if (!res.ok) return data;
          const categories = await res.json();
          return {
            props: {
              ...data.props,
              resolvedCategories: categories,
              basePath: `/store/${metadata.storeSlug}`,
            },
          };
        } catch {
          return data;
        }
      },
      render: FeaturedCategoriesSection as unknown as SectionRender,
    },

    ProductGrid: {
      label: "Product Grid",
      defaultProps: {
        title: "Products",
        source: "newest",
        productIds: [],
        categoryId: "",
        limit: 8,
        columns: 4,
        showViewAll: true,
        cardStyle: "standard",
        imageAspectRatio: "square",
        showPrice: true,
        showBadge: true,
        cardBorderRadius: "md",
        cardShadow: "sm",
        hoverEffect: "lift",
        textAlign: "left",
      },
      fields: {
        title: {
          type: "text",
          label: "Section Title",
        },
        source: {
          type: "select",
          label: "Product Source",
          options: [
            { label: "All Products", value: "all" },
            { label: "Hand-Picked", value: "manual" },
            { label: "By Category", value: "category" },
            { label: "Newest", value: "newest" },
            { label: "On Sale", value: "on_sale" },
          ],
        },
        productIds: {
          type: "custom",
          label: "Select Products",
          render: MultiProductPickerRender,
        },
        categoryId: {
          type: "custom",
          label: "Select Category",
          render: CategoryPickerFieldRender,
        },
        limit: {
          type: "number",
          label: "Max Products",
          min: 2,
          max: 24,
        },
        columns: {
          type: "select",
          label: "Columns",
          options: [
            { label: "2 Columns", value: 2 },
            { label: "3 Columns", value: 3 },
            { label: "4 Columns", value: 4 },
          ],
        },
        cardStyle: {
          type: "select",
          label: "Card Style",
          options: [
            { label: "Standard", value: "standard" },
            { label: "Minimal", value: "minimal" },
            { label: "Overlay", value: "overlay" },
          ],
        },
        imageAspectRatio: {
          type: "select",
          label: "Image Ratio",
          options: [
            { label: "Square (1:1)", value: "square" },
            { label: "Portrait (3:4)", value: "portrait" },
            { label: "Landscape (4:3)", value: "landscape" },
          ],
        },
        showPrice: {
          type: "radio",
          label: "Price",
          options: [
            { label: "Show", value: true },
            { label: "Hide", value: false },
          ],
        },
        showBadge: {
          type: "radio",
          label: "Sale Badge",
          options: [
            { label: "Show", value: true },
            { label: "Hide", value: false },
          ],
        },
        showViewAll: {
          type: "radio",
          label: "View All Link",
          options: [
            { label: "Show", value: true },
            { label: "Hide", value: false },
          ],
        },
        cardBorderRadius: {
          type: "select",
          label: "Card Corners",
          options: [
            { label: "None", value: "none" },
            { label: "Small", value: "sm" },
            { label: "Medium", value: "md" },
            { label: "Large", value: "lg" },
          ],
        },
        cardShadow: {
          type: "select",
          label: "Card Shadow",
          options: [
            { label: "None", value: "none" },
            { label: "Small", value: "sm" },
            { label: "Medium", value: "md" },
            { label: "Large", value: "lg" },
          ],
        },
        hoverEffect: {
          type: "select",
          label: "Hover Effect",
          options: [
            { label: "None", value: "none" },
            { label: "Lift", value: "lift" },
            { label: "Scale", value: "scale" },
            { label: "Glow", value: "glow" },
          ],
        },
        textAlign: {
          type: "radio",
          label: "Text Alignment",
          options: [
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
          ],
        },
      },
      resolveFields: (data, { fields }) => {
        const source = data.props.source;
        return {
          ...fields,
          productIds: {
            ...fields.productIds,
            label: source === "manual" ? "Select Products" : undefined,
          },
          categoryId: {
            ...fields.categoryId,
            label: source === "category" ? "Select Category" : undefined,
          },
        };
      },
      resolveData: async (
        data: ResolveDataInput,
        { metadata }: ResolveDataContext
      ) => {
        if (!metadata?.tenantId) return data;
        try {
          const res = await fetch("/api/page-builder/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tenantId: metadata.tenantId,
              type: "products",
              params: {
                source: data.props.source,
                productIds: data.props.productIds,
                categoryId: data.props.categoryId,
                limit: data.props.limit,
              },
            }),
          });
          if (!res.ok) return data;
          const products = await res.json();
          return {
            props: {
              ...data.props,
              resolvedProducts: products,
              basePath: `/store/${metadata.storeSlug}`,
              currency: metadata.currency,
            },
          };
        } catch {
          return data;
        }
      },
      render: ProductGridSection as unknown as SectionRender,
    },

    ProductSpotlight: {
      label: "Product Spotlight",
      defaultProps: {
        productId: "",
        layout: "image_left",
        showDescription: true,
        showPrice: true,
        ctaText: "View Product",
        backgroundColor: "",
      },
      fields: {
        productId: {
          type: "custom",
          label: "Product",
          render: SingleProductPickerRender,
        },
        layout: {
          type: "radio",
          label: "Layout",
          options: [
            { label: "Image Left", value: "image_left" },
            { label: "Image Right", value: "image_right" },
          ],
        },
        showPrice: {
          type: "radio",
          label: "Price",
          options: [
            { label: "Show", value: true },
            { label: "Hide", value: false },
          ],
        },
        showDescription: {
          type: "radio",
          label: "Description",
          options: [
            { label: "Show", value: true },
            { label: "Hide", value: false },
          ],
        },
        ctaText: {
          type: "text",
          label: "Button Text",
        },
        backgroundColor: {
          type: "custom",
          label: "Background Color",
          render: ColorFieldRender,
        },
      },
      resolveData: async (
        data: ResolveDataInput,
        { metadata }: ResolveDataContext
      ) => {
        if (!metadata?.tenantId || !data.props.productId) return data;
        try {
          const res = await fetch("/api/page-builder/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tenantId: metadata.tenantId,
              type: "product",
              params: { productId: data.props.productId },
            }),
          });
          if (!res.ok) return data;
          const product = await res.json();
          return {
            props: {
              ...data.props,
              resolvedProduct: product,
              basePath: `/store/${metadata.storeSlug}`,
              currency: metadata.currency,
            },
          };
        } catch {
          return data;
        }
      },
      render: ProductSpotlightSection as unknown as SectionRender,
    },

    RichText: {
      label: "Rich Text",
      defaultProps: {
        content: "<p>Add your content here...</p>",
        maxWidth: "medium",
        padding: "medium",
      },
      fields: {
        content: {
          type: "textarea",
          label: "Content (HTML)",
        },
        maxWidth: {
          type: "select",
          label: "Max Width",
          options: [
            { label: "Narrow", value: "narrow" },
            { label: "Medium", value: "medium" },
            { label: "Full Width", value: "full" },
          ],
        },
        padding: {
          type: "select",
          label: "Vertical Padding",
          options: [
            { label: "None", value: "none" },
            { label: "Small", value: "small" },
            { label: "Medium", value: "medium" },
            { label: "Large", value: "large" },
          ],
        },
      },
      render: RichTextSection as unknown as SectionRender,
    },

    AnnouncementBar: {
      label: "Announcement Bar",
      defaultProps: {
        text: "Free shipping on orders over $50!",
        linkText: "Shop now",
        linkUrl: "/products",
        backgroundColor: "#000000",
        textColor: "#ffffff",
        dismissible: true,
        icon: "megaphone",
      },
      fields: {
        text: {
          type: "text",
          label: "Text",
        },
        linkText: {
          type: "text",
          label: "Link Text",
        },
        linkUrl: {
          type: "text",
          label: "Link URL",
        },
        backgroundColor: {
          type: "custom",
          label: "Background Color",
          render: ColorFieldRender,
        },
        textColor: {
          type: "custom",
          label: "Text Color",
          render: ColorFieldRender,
        },
        dismissible: {
          type: "radio",
          label: "Dismissible",
          options: [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ],
        },
        icon: {
          type: "select",
          label: "Icon",
          options: [
            { label: "None", value: "none" },
            { label: "Megaphone", value: "megaphone" },
            { label: "Tag", value: "tag" },
            { label: "Sparkles", value: "sparkles" },
            { label: "Truck", value: "truck" },
          ],
        },
      },
      render: AnnouncementBar as unknown as SectionRender,
    },

    ImageGallery: {
      label: "Image Gallery",
      defaultProps: {
        title: "",
        images: [],
        layout: "grid",
        columns: 3,
        gap: "md",
        aspectRatio: "square",
      },
      fields: {
        title: {
          type: "text",
          label: "Section Title",
        },
        images: {
          type: "custom",
          label: "Images",
          render: MultiImagePickerFieldRender,
        },
        layout: {
          type: "radio",
          label: "Layout",
          options: [
            { label: "Grid", value: "grid" },
            { label: "Masonry", value: "masonry" },
            { label: "Carousel", value: "carousel" },
          ],
        },
        columns: {
          type: "select",
          label: "Columns",
          options: [
            { label: "2 Columns", value: 2 },
            { label: "3 Columns", value: 3 },
            { label: "4 Columns", value: 4 },
          ],
        },
        gap: {
          type: "select",
          label: "Gap",
          options: [
            { label: "None", value: "none" },
            { label: "Small", value: "sm" },
            { label: "Medium", value: "md" },
            { label: "Large", value: "lg" },
          ],
        },
        aspectRatio: {
          type: "select",
          label: "Aspect Ratio",
          options: [
            { label: "Square", value: "square" },
            { label: "Landscape", value: "landscape" },
            { label: "Portrait", value: "portrait" },
            { label: "Auto", value: "auto" },
          ],
        },
      },
      render: ImageGallerySection as unknown as SectionRender,
    },

    Testimonials: {
      label: "Testimonials",
      defaultProps: {
        title: "What Our Customers Say",
        subtitle: "",
        testimonials: [],
        layout: "grid",
        columns: 3,
        showRating: true,
        backgroundColor: "",
      },
      fields: {
        title: {
          type: "text",
          label: "Section Title",
        },
        subtitle: {
          type: "text",
          label: "Subtitle",
        },
        testimonials: {
          type: "custom",
          label: "Testimonials",
          render: TestimonialListFieldRender,
        },
        layout: {
          type: "radio",
          label: "Layout",
          options: [
            { label: "Grid", value: "grid" },
            { label: "Carousel", value: "carousel" },
            { label: "Stacked", value: "stacked" },
          ],
        },
        columns: {
          type: "select",
          label: "Columns",
          options: [
            { label: "2 Columns", value: 2 },
            { label: "3 Columns", value: 3 },
          ],
        },
        showRating: {
          type: "radio",
          label: "Star Rating",
          options: [
            { label: "Show", value: true },
            { label: "Hide", value: false },
          ],
        },
        backgroundColor: {
          type: "custom",
          label: "Background Color",
          render: ColorFieldRender,
        },
      },
      render: TestimonialsSection as unknown as SectionRender,
    },

    BentoGrid: {
      label: "Bento Grid",
      defaultProps: {
        title: "",
        gridTemplate: "2x2",
        gap: "md",
        minHeight: "medium",
      },
      fields: {
        title: {
          type: "text",
          label: "Section Title",
        },
        gridTemplate: {
          type: "select",
          label: "Grid Layout",
          options: [
            { label: "2×2 Equal", value: "2x2" },
            { label: "1 Top + 2 Bottom", value: "1-2" },
            { label: "2 Top + 1 Bottom", value: "2-1" },
            { label: "Featured Left", value: "featured-left" },
            { label: "Featured Right", value: "featured-right" },
          ],
        },
        gap: {
          type: "select",
          label: "Gap",
          options: [
            { label: "None", value: "none" },
            { label: "Small", value: "sm" },
            { label: "Medium", value: "md" },
            { label: "Large", value: "lg" },
          ],
        },
        minHeight: {
          type: "select",
          label: "Min Height",
          options: [
            { label: "Small (300px)", value: "small" },
            { label: "Medium (450px)", value: "medium" },
            { label: "Large (600px)", value: "large" },
          ],
        },
      },
      render: BentoGridSection as unknown as SectionRender,
    },

    Spacer: {
      label: "Spacer",
      defaultProps: {
        height: "md",
      },
      fields: {
        height: {
          type: "select",
          label: "Height",
          options: [
            { label: "Extra Small (16px)", value: "xs" },
            { label: "Small (32px)", value: "sm" },
            { label: "Medium (48px)", value: "md" },
            { label: "Large (64px)", value: "lg" },
            { label: "Extra Large (96px)", value: "xl" },
          ],
        },
      },
      render: SpacerSection as unknown as SectionRender,
    },

    StoreHeader: {
      label: "Header",
      defaultProps: {
        config: defaultHeaderConfig,
      },
      fields: {
        config: {
          type: "custom",
          label: "Header Settings",
          render: HeaderSettingsFieldRender,
        },
      },
      render: StoreHeaderPreview as unknown as SectionRender,
    },

    StoreFooter: {
      label: "Footer",
      defaultProps: {
        config: defaultFooterConfig,
      },
      fields: {
        config: {
          type: "custom",
          label: "Footer Settings",
          render: FooterSettingsFieldRender,
        },
      },
      render: StoreFooterPreview as unknown as SectionRender,
    },

    VideoHero: {
      label: "Video Hero",
      defaultProps: {
        mediaType: "image",
        imageUrl: "",
        mobileImageUrl: "",
        videoUrl: "",
        mobileVideoUrl: "",
        videoPosterUrl: "",
        mobileVideoPosterUrl: "",
        autoplay: true,
        loop: true,
        muted: true,
        overlayOpacity: 30,
        overlayColor: "#000000",
        heading: "Your Collection",
        subheading: "",
        headingSize: "xl",
        textAlign: "center",
        textColor: "light",
        overlayImageUrl: "",
        ctaButtons: [],
        height: "lg",
        contentPosition: "center",
      },
      fields: {
        mediaType: {
          type: "radio",
          label: "Media Type",
          options: [
            { label: "Image", value: "image" },
            { label: "Video", value: "video" },
          ],
        },
        imageUrl: {
          type: "custom",
          label: "Background Image",
          render: ImagePickerFieldRender,
        },
        mobileImageUrl: {
          type: "custom",
          label: "Mobile Image",
          render: ImagePickerFieldRender,
        },
        videoUrl: {
          type: "text",
          label: "Desktop Video URL",
        },
        mobileVideoUrl: {
          type: "text",
          label: "Mobile Video URL",
        },
        videoPosterUrl: {
          type: "custom",
          label: "Video Poster Image",
          render: ImagePickerFieldRender,
        },
        mobileVideoPosterUrl: {
          type: "custom",
          label: "Mobile Video Poster",
          render: ImagePickerFieldRender,
        },
        autoplay: {
          type: "radio",
          label: "Autoplay",
          options: [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ],
        },
        loop: {
          type: "radio",
          label: "Loop",
          options: [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ],
        },
        muted: {
          type: "radio",
          label: "Muted",
          options: [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ],
        },
        overlayOpacity: {
          type: "number",
          label: "Overlay Opacity (%)",
          min: 0,
          max: 100,
        },
        overlayColor: {
          type: "custom",
          label: "Overlay Color",
          render: ColorFieldRender,
        },
        heading: {
          type: "text",
          label: "Heading",
        },
        subheading: {
          type: "textarea",
          label: "Subheading",
        },
        headingSize: {
          type: "select",
          label: "Heading Size",
          options: [
            { label: "Medium", value: "md" },
            { label: "Large", value: "lg" },
            { label: "Extra Large", value: "xl" },
            { label: "2X Large", value: "2xl" },
          ],
        },
        textAlign: {
          type: "radio",
          label: "Text Alignment",
          options: [
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
            { label: "Right", value: "right" },
          ],
        },
        textColor: {
          type: "radio",
          label: "Text Color",
          options: [
            { label: "Light", value: "light" },
            { label: "Dark", value: "dark" },
          ],
        },
        overlayImageUrl: {
          type: "custom",
          label: "Overlay Logo/Badge",
          render: ImagePickerFieldRender,
        },
        ctaButtons: {
          type: "custom",
          label: "CTA Buttons",
          render: CTAButtonsFieldRender,
        },
        height: {
          type: "select",
          label: "Section Height",
          options: [
            { label: "Small (300px)", value: "sm" },
            { label: "Medium (500px)", value: "md" },
            { label: "Large (700px)", value: "lg" },
            { label: "Full Screen", value: "full" },
          ],
        },
        contentPosition: {
          type: "select",
          label: "Content Position",
          options: [
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
            { label: "Right", value: "right" },
            { label: "Bottom Left", value: "bottom-left" },
            { label: "Bottom Center", value: "bottom-center" },
          ],
        },
      },
      render: VideoHero as unknown as SectionRender,
    },

    ProductCarousel: {
      label: "Product Carousel",
      defaultProps: {
        heading: "Featured Products",
        subtitle: "",
        source: "newest",
        productIds: [],
        categoryId: "",
        limit: 8,
        showViewAll: true,
        viewAllUrl: "",
        slidesPerView: "4",
        showArrows: true,
        cardStyle: "standard",
        backgroundColor: "",
        textColor: "dark",
      },
      fields: {
        heading: {
          type: "text",
          label: "Heading",
        },
        subtitle: {
          type: "text",
          label: "Subtitle (small text above heading)",
        },
        source: {
          type: "select",
          label: "Product Source",
          options: [
            { label: "All Products", value: "all" },
            { label: "Hand-Picked", value: "manual" },
            { label: "By Category", value: "category" },
            { label: "Newest", value: "newest" },
            { label: "On Sale", value: "on_sale" },
          ],
        },
        productIds: {
          type: "custom",
          label: "Select Products",
          render: MultiProductPickerRender,
        },
        categoryId: {
          type: "custom",
          label: "Select Category",
          render: CategoryPickerFieldRender,
        },
        limit: {
          type: "number",
          label: "Max Products",
          min: 2,
          max: 20,
        },
        showViewAll: {
          type: "radio",
          label: "View All Link",
          options: [
            { label: "Show", value: true },
            { label: "Hide", value: false },
          ],
        },
        viewAllUrl: {
          type: "text",
          label: "View All URL",
        },
        slidesPerView: {
          type: "select",
          label: "Slides Per View (Desktop)",
          options: [
            { label: "2 Slides", value: "2" },
            { label: "3 Slides", value: "3" },
            { label: "4 Slides", value: "4" },
          ],
        },
        showArrows: {
          type: "radio",
          label: "Navigation Arrows",
          options: [
            { label: "Show", value: true },
            { label: "Hide", value: false },
          ],
        },
        cardStyle: {
          type: "select",
          label: "Card Style",
          options: [
            { label: "Standard", value: "standard" },
            { label: "Compact", value: "compact" },
            { label: "Minimal", value: "minimal" },
          ],
        },
        backgroundColor: {
          type: "custom",
          label: "Background Color",
          render: ColorFieldRender,
        },
        textColor: {
          type: "radio",
          label: "Text Color",
          options: [
            { label: "Dark", value: "dark" },
            { label: "Light", value: "light" },
          ],
        },
      },
      resolveData: async (
        data: ResolveDataInput,
        { metadata }: ResolveDataContext
      ) => {
        if (!metadata?.tenantId) return data;
        try {
          const res = await fetch("/api/page-builder/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tenantId: metadata.tenantId,
              type: "products",
              params: {
                source: data.props.source,
                productIds: data.props.productIds,
                categoryId: data.props.categoryId,
                limit: data.props.limit,
              },
            }),
          });
          if (!res.ok) return data;
          const products = await res.json();
          return {
            props: {
              ...data.props,
              resolvedProducts: products,
              basePath: `/store/${metadata.storeSlug}`,
              currency: metadata.currency,
            },
          };
        } catch {
          return data;
        }
      },
      render: ProductCarouselSection as unknown as SectionRender,
    },

    CollectionTabs: {
      label: "Collection Tabs",
      defaultProps: {
        heading: "Popular Right Now",
        tabs: [],
        layout: "grid",
        columns: "4",
        cardStyle: "overlay",
        gap: "md",
        backgroundColor: "",
      },
      fields: {
        heading: {
          type: "text",
          label: "Heading",
        },
        tabs: {
          type: "custom",
          label: "Tabs",
          render: TabsFieldRender,
        },
        layout: {
          type: "radio",
          label: "Layout",
          options: [
            { label: "Grid", value: "grid" },
            { label: "Carousel", value: "carousel" },
          ],
        },
        columns: {
          type: "select",
          label: "Columns",
          options: [
            { label: "2 Columns", value: "2" },
            { label: "3 Columns", value: "3" },
            { label: "4 Columns", value: "4" },
          ],
        },
        cardStyle: {
          type: "radio",
          label: "Title Position",
          options: [
            { label: "Overlay", value: "overlay" },
            { label: "Below", value: "below" },
          ],
        },
        gap: {
          type: "select",
          label: "Gap",
          options: [
            { label: "Small", value: "sm" },
            { label: "Medium", value: "md" },
            { label: "Large", value: "lg" },
          ],
        },
        backgroundColor: {
          type: "custom",
          label: "Background Color",
          render: ColorFieldRender,
        },
      },
      render: CollectionTabs as unknown as SectionRender,
    },

    MarqueeBar: {
      label: "Marquee Bar",
      defaultProps: {
        items: [
          { text: "Free Delivery Over 2000 AFN", icon: "truck", href: "" },
          { text: "60 Day Returns", icon: "refresh", href: "" },
          { text: "1-2 Day Delivery", icon: "clock", href: "" },
        ],
        speed: "normal",
        direction: "left",
        backgroundColor: "#000000",
        textColor: "#ffffff",
        pauseOnHover: true,
        fontSize: "sm",
        separator: "dot",
      },
      fields: {
        items: {
          type: "custom",
          label: "Marquee Items",
          render: MarqueeItemsFieldRender,
        },
        speed: {
          type: "select",
          label: "Speed",
          options: [
            { label: "Slow", value: "slow" },
            { label: "Normal", value: "normal" },
            { label: "Fast", value: "fast" },
          ],
        },
        direction: {
          type: "radio",
          label: "Direction",
          options: [
            { label: "Left", value: "left" },
            { label: "Right", value: "right" },
          ],
        },
        backgroundColor: {
          type: "custom",
          label: "Background Color",
          render: ColorFieldRender,
        },
        textColor: {
          type: "custom",
          label: "Text Color",
          render: ColorFieldRender,
        },
        pauseOnHover: {
          type: "radio",
          label: "Pause on Hover",
          options: [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ],
        },
        fontSize: {
          type: "select",
          label: "Font Size",
          options: [
            { label: "Extra Small", value: "xs" },
            { label: "Small", value: "sm" },
            { label: "Medium", value: "md" },
          ],
        },
        separator: {
          type: "select",
          label: "Separator",
          options: [
            { label: "Dot", value: "dot" },
            { label: "Pipe", value: "pipe" },
            { label: "Star", value: "star" },
            { label: "None", value: "none" },
          ],
        },
      },
      render: MarqueeBar as unknown as SectionRender,
    },

    ContentCards: {
      label: "Content Cards",
      defaultProps: {
        heading: "",
        cards: [],
        layout: "grid",
        columns: "3",
        gap: "md",
        cardStyle: "overlay-bottom",
        overlayGradient: true,
        backgroundColor: "",
      },
      fields: {
        heading: {
          type: "text",
          label: "Heading",
        },
        cards: {
          type: "custom",
          label: "Cards",
          render: CardListFieldRender,
        },
        layout: {
          type: "radio",
          label: "Layout",
          options: [
            { label: "Grid", value: "grid" },
            { label: "Carousel", value: "carousel" },
          ],
        },
        columns: {
          type: "select",
          label: "Columns",
          options: [
            { label: "2 Columns", value: "2" },
            { label: "3 Columns", value: "3" },
            { label: "4 Columns", value: "4" },
          ],
        },
        gap: {
          type: "select",
          label: "Gap",
          options: [
            { label: "None", value: "none" },
            { label: "Small", value: "sm" },
            { label: "Medium", value: "md" },
            { label: "Large", value: "lg" },
          ],
        },
        cardStyle: {
          type: "select",
          label: "Card Style",
          options: [
            { label: "Overlay Bottom", value: "overlay-bottom" },
            { label: "Overlay Center", value: "overlay-center" },
            { label: "Text Below", value: "below" },
          ],
        },
        overlayGradient: {
          type: "radio",
          label: "Overlay Gradient",
          options: [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ],
        },
        backgroundColor: {
          type: "custom",
          label: "Background Color",
          render: ColorFieldRender,
        },
      },
      render: ContentCardsSection as unknown as SectionRender,
    },
  },
};
