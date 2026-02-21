import type { PuckPageData } from "./types";
import {
  defaultHeaderConfig,
  defaultFooterConfig,
} from "@/lib/theme/layout-types";

export interface PageTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  data: PuckPageData;
}

// Shared header/footer sections for all templates
const headerSection = {
  type: "StoreHeader",
  props: { id: "store-header", config: defaultHeaderConfig },
};
const footerSection = {
  type: "StoreFooter",
  props: { id: "store-footer", config: defaultFooterConfig },
};

/**
 * Code-defined page templates. No DB table needed.
 * Each template is a complete PuckPageData snapshot.
 */
export const pageTemplates: PageTemplate[] = [
  {
    id: "product-launch",
    name: "Product Launch",
    description: "Hero banner, newest products grid, and featured categories",
    category: "Commerce",
    data: {
      root: { props: {} },
      content: [
        headerSection,
        {
          type: "HeroBanner",
          props: {
            id: "tpl-hero-1",
            imageUrl: "",
            imageAlt: "",
            title: "New Collection",
            subtitle: "Discover our latest arrivals",
            ctaText: "Shop Now",
            ctaLink: "/products",
            overlayOpacity: 40,
            textAlignment: "center",
            minHeight: "large",
          },
        },
        {
          type: "Spacer",
          props: { id: "tpl-spacer-1", height: "md" },
        },
        {
          type: "ProductGrid",
          props: {
            id: "tpl-products-1",
            title: "New Arrivals",
            source: "newest",
            productIds: [],
            categoryId: "",
            limit: 8,
            columns: 4,
            showViewAll: true,
          },
        },
        {
          type: "Spacer",
          props: { id: "tpl-spacer-2", height: "md" },
        },
        {
          type: "FeaturedCategories",
          props: {
            id: "tpl-cats-1",
            title: "Shop by Category",
            categoryIds: [],
            layout: "grid",
            columns: 3,
            showProductCount: true,
          },
        },
        footerSection,
      ],
    },
  },
  {
    id: "sale-event",
    name: "Sale Event",
    description: "Announcement bar, bold hero, and on-sale products grid",
    category: "Promotions",
    data: {
      root: { props: {} },
      content: [
        headerSection,
        {
          type: "AnnouncementBar",
          props: {
            id: "tpl-ann-1",
            text: "Limited time offer! Up to 50% off everything",
            linkText: "Shop the sale",
            linkUrl: "/products",
            backgroundColor: "#dc2626",
            textColor: "#ffffff",
            dismissible: true,
            icon: "tag",
          },
        },
        {
          type: "HeroBanner",
          props: {
            id: "tpl-hero-2",
            imageUrl: "",
            imageAlt: "",
            title: "Big Sale Event",
            subtitle: "Don't miss out on our biggest discounts of the year",
            ctaText: "Browse Deals",
            ctaLink: "/products",
            overlayOpacity: 50,
            textAlignment: "center",
            minHeight: "medium",
          },
        },
        {
          type: "ProductGrid",
          props: {
            id: "tpl-products-2",
            title: "On Sale Now",
            source: "on_sale",
            productIds: [],
            categoryId: "",
            limit: 12,
            columns: 4,
            showViewAll: true,
          },
        },
        footerSection,
      ],
    },
  },
  {
    id: "brand-story",
    name: "Brand Story",
    description:
      "Hero, rich text about your brand, image gallery, and testimonials",
    category: "Branding",
    data: {
      root: { props: {} },
      content: [
        headerSection,
        {
          type: "HeroBanner",
          props: {
            id: "tpl-hero-3",
            imageUrl: "",
            imageAlt: "",
            title: "Our Story",
            subtitle: "Crafted with care, delivered with love",
            ctaText: "Learn More",
            ctaLink: "#about",
            overlayOpacity: 30,
            textAlignment: "center",
            minHeight: "large",
          },
        },
        {
          type: "RichText",
          props: {
            id: "tpl-text-1",
            content:
              "<h2>About Us</h2><p>We believe in quality and craftsmanship. Every product we offer is carefully curated to bring you the best. Our journey started with a simple idea: make great products accessible to everyone.</p>",
            maxWidth: "medium",
            padding: "large",
          },
        },
        {
          type: "ImageGallery",
          props: {
            id: "tpl-gallery-1",
            title: "Behind the Scenes",
            images: [],
            layout: "grid",
            columns: 3,
            gap: "md",
            aspectRatio: "landscape",
          },
        },
        {
          type: "Spacer",
          props: { id: "tpl-spacer-3", height: "lg" },
        },
        {
          type: "Testimonials",
          props: {
            id: "tpl-testimonials-1",
            title: "What Our Customers Say",
            subtitle: "",
            testimonials: [
              {
                quote:
                  "Amazing quality and fast delivery. Will definitely order again!",
                authorName: "Happy Customer",
                authorRole: "Verified Buyer",
                authorImageUrl: "",
                rating: 5,
              },
              {
                quote:
                  "The best shopping experience I've had. Great customer service too.",
                authorName: "Satisfied Shopper",
                authorRole: "Loyal Customer",
                authorImageUrl: "",
                rating: 5,
              },
              {
                quote:
                  "High quality products at fair prices. Highly recommended!",
                authorName: "Product Fan",
                authorRole: "Repeat Buyer",
                authorImageUrl: "",
                rating: 4,
              },
            ],
            layout: "grid",
            columns: 3,
            showRating: true,
            backgroundColor: "",
          },
        },
        footerSection,
      ],
    },
  },
  {
    id: "minimal-catalog",
    name: "Minimal Catalog",
    description: "Clean product grid with categories — no hero banner",
    category: "Commerce",
    data: {
      root: { props: {} },
      content: [
        headerSection,
        {
          type: "Spacer",
          props: { id: "tpl-spacer-4", height: "sm" },
        },
        {
          type: "ProductGrid",
          props: {
            id: "tpl-products-3",
            title: "All Products",
            source: "all",
            productIds: [],
            categoryId: "",
            limit: 12,
            columns: 4,
            showViewAll: false,
          },
        },
        {
          type: "Spacer",
          props: { id: "tpl-spacer-5", height: "lg" },
        },
        {
          type: "FeaturedCategories",
          props: {
            id: "tpl-cats-2",
            title: "Categories",
            categoryIds: [],
            layout: "scroll",
            columns: 4,
            showProductCount: true,
          },
        },
        footerSection,
      ],
    },
  },
  {
    id: "classic-store",
    name: "Classic Store",
    description:
      "The default store look — product grid with standard header and footer. No custom sections needed.",
    category: "Commerce",
    data: {
      root: { props: {} },
      content: [headerSection, footerSection],
    },
  },
  {
    id: "gymshark-style",
    name: "GymShark Style",
    description:
      "Enterprise-level layout with marquee bar, video hero, product carousels, tabbed collections, and content cards",
    category: "Enterprise",
    data: {
      root: { props: {} },
      content: [
        headerSection,
        {
          type: "MarqueeBar",
          props: {
            id: "tpl-marquee-1",
            items: [
              { text: "Free Delivery Over 2000 AFN", icon: "truck", href: "" },
              { text: "60 Day Returns", icon: "refresh", href: "" },
              { text: "1-2 Day Delivery", icon: "clock", href: "" },
              { text: "Secure Payments", icon: "shield", href: "" },
            ],
            speed: "normal",
            direction: "left",
            backgroundColor: "#000000",
            textColor: "#ffffff",
            pauseOnHover: true,
            fontSize: "sm",
            separator: "dot",
          },
        },
        {
          type: "VideoHero",
          props: {
            id: "tpl-video-hero-1",
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
            heading: "NEW COLLECTION",
            subheading: "Discover the latest styles",
            headingSize: "2xl",
            textAlign: "center",
            textColor: "light",
            overlayImageUrl: "",
            ctaButtons: [
              { text: "Shop Now", href: "/products", style: "primary" },
              { text: "Learn More", href: "#about", style: "outline" },
            ],
            height: "lg",
            contentPosition: "center",
          },
        },
        {
          type: "Spacer",
          props: { id: "tpl-gs-spacer-1", height: "md" },
        },
        {
          type: "ProductCarousel",
          props: {
            id: "tpl-carousel-1",
            heading: "New Arrivals",
            subtitle: "Just dropped",
            source: "newest",
            productIds: [],
            categoryId: "",
            limit: 12,
            showViewAll: true,
            viewAllUrl: "/products",
            slidesPerView: "4",
            showArrows: true,
            cardStyle: "standard",
            backgroundColor: "",
            textColor: "dark",
          },
        },
        {
          type: "Spacer",
          props: { id: "tpl-gs-spacer-2", height: "md" },
        },
        {
          type: "HeroBanner",
          props: {
            id: "tpl-gs-banner-2",
            imageUrl: "",
            mobileImageUrl: "",
            imageAlt: "",
            title: "Best Sellers",
            subtitle: "Our most popular products",
            headingSize: "xl",
            ctaText: "",
            ctaLink: "",
            ctaButtons: [
              {
                text: "Shop Best Sellers",
                href: "/products",
                style: "primary",
              },
            ],
            overlayOpacity: 40,
            textAlignment: "center",
            contentPosition: "center",
            minHeight: "medium",
          },
        },
        {
          type: "Spacer",
          props: { id: "tpl-gs-spacer-3", height: "md" },
        },
        {
          type: "ProductCarousel",
          props: {
            id: "tpl-carousel-2",
            heading: "Best Sellers",
            subtitle: "Top picks",
            source: "all",
            productIds: [],
            categoryId: "",
            limit: 12,
            showViewAll: true,
            viewAllUrl: "/products",
            slidesPerView: "4",
            showArrows: true,
            cardStyle: "standard",
            backgroundColor: "",
            textColor: "dark",
          },
        },
        {
          type: "Spacer",
          props: { id: "tpl-gs-spacer-4", height: "md" },
        },
        {
          type: "CollectionTabs",
          props: {
            id: "tpl-tabs-1",
            heading: "POPULAR RIGHT NOW",
            tabs: [
              {
                label: "Women",
                cards: [
                  {
                    imageUrl: "",
                    mobileImageUrl: "",
                    title: "Tops",
                    subtitle: "",
                    href: "/products",
                    aspectRatio: "4/5",
                  },
                  {
                    imageUrl: "",
                    mobileImageUrl: "",
                    title: "Bottoms",
                    subtitle: "",
                    href: "/products",
                    aspectRatio: "4/5",
                  },
                  {
                    imageUrl: "",
                    mobileImageUrl: "",
                    title: "Accessories",
                    subtitle: "",
                    href: "/products",
                    aspectRatio: "4/5",
                  },
                  {
                    imageUrl: "",
                    mobileImageUrl: "",
                    title: "Shoes",
                    subtitle: "",
                    href: "/products",
                    aspectRatio: "4/5",
                  },
                ],
              },
              {
                label: "Men",
                cards: [
                  {
                    imageUrl: "",
                    mobileImageUrl: "",
                    title: "Tops",
                    subtitle: "",
                    href: "/products",
                    aspectRatio: "4/5",
                  },
                  {
                    imageUrl: "",
                    mobileImageUrl: "",
                    title: "Bottoms",
                    subtitle: "",
                    href: "/products",
                    aspectRatio: "4/5",
                  },
                  {
                    imageUrl: "",
                    mobileImageUrl: "",
                    title: "Accessories",
                    subtitle: "",
                    href: "/products",
                    aspectRatio: "4/5",
                  },
                  {
                    imageUrl: "",
                    mobileImageUrl: "",
                    title: "Shoes",
                    subtitle: "",
                    href: "/products",
                    aspectRatio: "4/5",
                  },
                ],
              },
            ],
            layout: "grid",
            columns: "4",
            cardStyle: "overlay",
            gap: "md",
            backgroundColor: "",
          },
        },
        {
          type: "Spacer",
          props: { id: "tpl-gs-spacer-5", height: "md" },
        },
        {
          type: "ContentCards",
          props: {
            id: "tpl-content-cards-1",
            heading: "Shop by Category",
            cards: [
              {
                imageUrl: "",
                mobileImageUrl: "",
                title: "Women",
                subtitle: "New season styles",
                href: "/products",
                ctaText: "Shop Women",
                aspectRatio: "4/5",
              },
              {
                imageUrl: "",
                mobileImageUrl: "",
                title: "Men",
                subtitle: "Latest collection",
                href: "/products",
                ctaText: "Shop Men",
                aspectRatio: "4/5",
              },
              {
                imageUrl: "",
                mobileImageUrl: "",
                title: "Accessories",
                subtitle: "Complete the look",
                href: "/products",
                ctaText: "Shop Now",
                aspectRatio: "4/5",
              },
            ],
            layout: "grid",
            columns: "3",
            gap: "md",
            cardStyle: "overlay-bottom",
            overlayGradient: true,
            backgroundColor: "",
          },
        },
        footerSection,
      ],
    },
  },
  {
    id: "fashion-brand",
    name: "Fashion Brand",
    description:
      "Elegant layout with announcement bar, hero image, product carousels, content cards, and tabbed collections",
    category: "Enterprise",
    data: {
      root: { props: {} },
      content: [
        headerSection,
        {
          type: "AnnouncementBar",
          props: {
            id: "tpl-fb-ann-1",
            text: "Season Sale — Up to 40% off selected items",
            linkText: "Shop the sale",
            linkUrl: "/products",
            backgroundColor: "#18181b",
            textColor: "#ffffff",
            dismissible: true,
            icon: "sparkles",
          },
        },
        {
          type: "HeroBanner",
          props: {
            id: "tpl-fb-hero-1",
            imageUrl: "",
            mobileImageUrl: "",
            imageAlt: "",
            title: "The New Edit",
            subtitle: "Curated styles for every occasion",
            headingSize: "2xl",
            ctaText: "",
            ctaLink: "",
            ctaButtons: [
              { text: "Shop Collection", href: "/products", style: "primary" },
              { text: "View Lookbook", href: "#lookbook", style: "outline" },
            ],
            overlayOpacity: 35,
            textAlignment: "center",
            contentPosition: "bottom-center",
            minHeight: "large",
          },
        },
        {
          type: "Spacer",
          props: { id: "tpl-fb-spacer-1", height: "md" },
        },
        {
          type: "ProductCarousel",
          props: {
            id: "tpl-fb-carousel-1",
            heading: "Featured Collection",
            subtitle: "Handpicked favorites",
            source: "newest",
            productIds: [],
            categoryId: "",
            limit: 10,
            showViewAll: true,
            viewAllUrl: "/products",
            slidesPerView: "4",
            showArrows: true,
            cardStyle: "standard",
            backgroundColor: "",
            textColor: "dark",
          },
        },
        {
          type: "Spacer",
          props: { id: "tpl-fb-spacer-2", height: "md" },
        },
        {
          type: "ContentCards",
          props: {
            id: "tpl-fb-content-1",
            heading: "",
            cards: [
              {
                imageUrl: "",
                mobileImageUrl: "",
                title: "Shop Women",
                subtitle: "New season arrivals",
                href: "/products",
                ctaText: "Explore",
                aspectRatio: "3/4",
              },
              {
                imageUrl: "",
                mobileImageUrl: "",
                title: "Shop Men",
                subtitle: "Modern essentials",
                href: "/products",
                ctaText: "Explore",
                aspectRatio: "3/4",
              },
              {
                imageUrl: "",
                mobileImageUrl: "",
                title: "Accessories",
                subtitle: "Finishing touches",
                href: "/products",
                ctaText: "Explore",
                aspectRatio: "3/4",
              },
            ],
            layout: "grid",
            columns: "3",
            gap: "sm",
            cardStyle: "overlay-center",
            overlayGradient: true,
            backgroundColor: "",
          },
        },
        {
          type: "Spacer",
          props: { id: "tpl-fb-spacer-3", height: "md" },
        },
        {
          type: "ProductCarousel",
          props: {
            id: "tpl-fb-carousel-2",
            heading: "On Sale",
            subtitle: "Limited time offers",
            source: "on_sale",
            productIds: [],
            categoryId: "",
            limit: 10,
            showViewAll: true,
            viewAllUrl: "/products",
            slidesPerView: "4",
            showArrows: true,
            cardStyle: "standard",
            backgroundColor: "",
            textColor: "dark",
          },
        },
        {
          type: "Spacer",
          props: { id: "tpl-fb-spacer-4", height: "md" },
        },
        {
          type: "CollectionTabs",
          props: {
            id: "tpl-fb-tabs-1",
            heading: "HOW TO STYLE",
            tabs: [
              {
                label: "Casual",
                cards: [
                  {
                    imageUrl: "",
                    mobileImageUrl: "",
                    title: "Weekend Vibes",
                    subtitle: "Easy, relaxed looks",
                    href: "/products",
                    aspectRatio: "1/1",
                  },
                  {
                    imageUrl: "",
                    mobileImageUrl: "",
                    title: "Street Style",
                    subtitle: "Urban edge",
                    href: "/products",
                    aspectRatio: "1/1",
                  },
                  {
                    imageUrl: "",
                    mobileImageUrl: "",
                    title: "Loungewear",
                    subtitle: "Stay comfortable",
                    href: "/products",
                    aspectRatio: "1/1",
                  },
                ],
              },
              {
                label: "Formal",
                cards: [
                  {
                    imageUrl: "",
                    mobileImageUrl: "",
                    title: "Office Ready",
                    subtitle: "Professional looks",
                    href: "/products",
                    aspectRatio: "1/1",
                  },
                  {
                    imageUrl: "",
                    mobileImageUrl: "",
                    title: "Evening Wear",
                    subtitle: "Dress to impress",
                    href: "/products",
                    aspectRatio: "1/1",
                  },
                  {
                    imageUrl: "",
                    mobileImageUrl: "",
                    title: "Occasion Wear",
                    subtitle: "For special moments",
                    href: "/products",
                    aspectRatio: "1/1",
                  },
                ],
              },
            ],
            layout: "grid",
            columns: "3",
            cardStyle: "overlay",
            gap: "md",
            backgroundColor: "",
          },
        },
        {
          type: "Spacer",
          props: { id: "tpl-fb-spacer-5", height: "md" },
        },
        {
          type: "Testimonials",
          props: {
            id: "tpl-fb-testimonials-1",
            title: "What Our Customers Say",
            subtitle: "",
            testimonials: [
              {
                quote:
                  "Beautiful quality and the packaging was gorgeous. My new favorite store!",
                authorName: "Sarah K.",
                authorRole: "Verified Buyer",
                authorImageUrl: "",
                rating: 5,
              },
              {
                quote:
                  "Fast delivery and exactly as pictured. Will definitely order again.",
                authorName: "Ahmed R.",
                authorRole: "Repeat Customer",
                authorImageUrl: "",
                rating: 5,
              },
            ],
            layout: "grid",
            columns: 2,
            showRating: true,
            backgroundColor: "",
          },
        },
        footerSection,
      ],
    },
  },
];
