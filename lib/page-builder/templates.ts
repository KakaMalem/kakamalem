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
  previewColor?: string; // accent color shown in the template card
  data: PuckPageData;
}

// Shared header/footer sections — every template uses these
const headerSection = {
  type: "StoreHeader",
  props: { id: "store-header", config: defaultHeaderConfig },
};
const footerSection = {
  type: "StoreFooter",
  props: { id: "store-footer", config: defaultFooterConfig },
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. MODERN MINIMAL
//    Clean, image-focused layout for boutique / fashion stores.
//    Lets the product photography do the talking.
// ─────────────────────────────────────────────────────────────────────────────
const modernMinimal: PageTemplate = {
  id: "modern-minimal",
  name: "Modern Minimal",
  description:
    "Clean, image-focused layout. One bold hero, a product grid, and nothing in the way.",
  category: "General",
  previewColor: "#0f172a",
  data: {
    root: { props: {} },
    content: [
      headerSection,
      // Announcement bar — free shipping nudge
      {
        type: "AnnouncementBar",
        props: {
          id: "tpl-mm-bar",
          text: "Free delivery on orders over ؋2,000 — Shop now",
          linkText: "Browse",
          linkUrl: "/products",
          backgroundColor: "#0f172a",
          textColor: "#ffffff",
          dismissible: true,
          icon: "none",
        },
      },
      // Full-screen hero
      {
        type: "HeroBanner",
        props: {
          id: "tpl-mm-hero",
          imageUrl: "",
          mobileImageUrl: "",
          imageAlt: "Welcome to our store",
          title: "New Collection",
          subtitle: "Handpicked quality — delivered to your door in Afghanistan",
          headingSize: "2xl",
          ctaButtons: [
            { text: "Shop Now", href: "/products", style: "primary" },
            { text: "Browse Categories", href: "/categories", style: "outline" },
          ],
          overlayOpacity: 50,
          textAlignment: "center",
          contentPosition: "center",
          minHeight: "large",
        },
      },
      {
        type: "Spacer",
        props: { id: "tpl-mm-sp1", height: "lg" },
      },
      // Product grid — newest arrivals
      {
        type: "ProductGrid",
        props: {
          id: "tpl-mm-grid",
          title: "New Arrivals",
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
      },
      {
        type: "Spacer",
        props: { id: "tpl-mm-sp2", height: "xl" },
      },
      // Marquee — brand values strip
      {
        type: "MarqueeBar",
        props: {
          id: "tpl-mm-marquee",
          items: [
            { text: "Free Delivery", icon: "truck" },
            { text: "Secure Payment", icon: "shield" },
            { text: "Easy Returns", icon: "refresh" },
            { text: "Afghan Made", icon: "star" },
            { text: "Cash on Delivery", icon: "check" },
          ],
          speed: "slow",
          direction: "left",
          backgroundColor: "#f8fafc",
          textColor: "#0f172a",
          pauseOnHover: true,
          fontSize: "sm",
          separator: "dot",
        },
      },
      {
        type: "Spacer",
        props: { id: "tpl-mm-sp3", height: "lg" },
      },
      footerSection,
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. BAZAAR STYLE
//    Vibrant, category-heavy, sale-forward layout. Designed for busy general
//    merchants who carry many product lines — the Afghan bazaar aesthetic.
// ─────────────────────────────────────────────────────────────────────────────
const bazaarStyle: PageTemplate = {
  id: "bazaar-style",
  name: "Bazaar Style",
  description:
    "Vibrant and category-heavy. Perfect for merchants with many product lines and regular sales.",
  category: "Commerce",
  previewColor: "#dc2626",
  data: {
    root: { props: {} },
    content: [
      headerSection,
      // Red sale announcement bar
      {
        type: "AnnouncementBar",
        props: {
          id: "tpl-bz-bar",
          text: "🎉 Eid Sale — Up to 40% off selected items",
          linkText: "See Deals",
          linkUrl: "/products",
          backgroundColor: "#dc2626",
          textColor: "#ffffff",
          dismissible: false,
          icon: "none",
        },
      },
      // Hero with overlay content
      {
        type: "HeroBanner",
        props: {
          id: "tpl-bz-hero",
          imageUrl: "",
          mobileImageUrl: "",
          imageAlt: "Shop our biggest sale",
          title: "Everything You Need",
          subtitle:
            "Thousands of products. Afghan prices. Delivered to your door.",
          headingSize: "xl",
          ctaButtons: [
            { text: "Shop Sale", href: "/products", style: "primary" },
          ],
          overlayOpacity: 45,
          textAlignment: "left",
          contentPosition: "left",
          minHeight: "medium",
        },
      },
      // Featured categories
      {
        type: "FeaturedCategories",
        props: {
          id: "tpl-bz-cats",
          title: "Shop by Category",
          categoryIds: [],
          layout: "grid",
          columns: 4,
          showProductCount: true,
        },
      },
      {
        type: "Spacer",
        props: { id: "tpl-bz-sp1", height: "sm" },
      },
      // Newest arrivals carousel
      {
        type: "ProductCarousel",
        props: {
          id: "tpl-bz-carousel",
          heading: "Just Arrived",
          subtitle: "Fresh stock",
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
      // Sale banner strip — bento grid for promotions
      {
        type: "ContentCards",
        props: {
          id: "tpl-bz-promo",
          heading: "Special Offers",
          cards: [
            {
              id: "card-1",
              imageUrl: "",
              title: "Clothing & Fashion",
              subtitle: "Up to 30% off",
              linkUrl: "/categories",
              linkText: "Shop Now",
            },
            {
              id: "card-2",
              imageUrl: "",
              title: "Electronics",
              subtitle: "New arrivals weekly",
              linkUrl: "/categories",
              linkText: "Explore",
            },
            {
              id: "card-3",
              imageUrl: "",
              title: "Home & Kitchen",
              subtitle: "Afghan craftsmanship",
              linkUrl: "/categories",
              linkText: "Browse",
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
      {
        type: "Spacer",
        props: { id: "tpl-bz-sp2", height: "md" },
      },
      // On sale products grid
      {
        type: "ProductGrid",
        props: {
          id: "tpl-bz-sale",
          title: "On Sale Now",
          source: "on_sale",
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
      },
      {
        type: "Spacer",
        props: { id: "tpl-bz-sp3", height: "md" },
      },
      // Trust strip
      {
        type: "MarqueeBar",
        props: {
          id: "tpl-bz-marquee",
          items: [
            { text: "Cash on Delivery", icon: "check" },
            { text: "Fast Kabul Delivery", icon: "truck" },
            { text: "Nationwide Shipping", icon: "truck" },
            { text: "Secure Payments", icon: "shield" },
            { text: "Easy Returns", icon: "refresh" },
            { text: "Verified Sellers", icon: "star" },
          ],
          speed: "normal",
          direction: "left",
          backgroundColor: "#0f172a",
          textColor: "#ffffff",
          pauseOnHover: false,
          fontSize: "sm",
          separator: "dot",
        },
      },
      footerSection,
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. SINGLE PRODUCT
//    One flagship product as the entire store experience.
//    Spotlight, testimonials, and a clear call-to-action.
// ─────────────────────────────────────────────────────────────────────────────
const singleProduct: PageTemplate = {
  id: "single-product",
  name: "Single Product",
  description:
    "Put one product front and centre. Hero, spotlight, testimonials — built to convert.",
  category: "Commerce",
  previewColor: "#7c3aed",
  data: {
    root: { props: {} },
    content: [
      headerSection,
      // Hero specifically for the product
      {
        type: "HeroBanner",
        props: {
          id: "tpl-sp-hero",
          imageUrl: "",
          mobileImageUrl: "",
          imageAlt: "Product hero",
          title: "The Only One You Need",
          subtitle:
            "Premium quality. Authentic Afghan craftsmanship. Limited stock available.",
          headingSize: "2xl",
          ctaButtons: [
            { text: "Order Now", href: "/products", style: "primary" },
            { text: "Learn More", href: "#details", style: "outline" },
          ],
          overlayOpacity: 55,
          textAlignment: "center",
          contentPosition: "center",
          minHeight: "large",
        },
      },
      // Product spotlight — the star of the show
      {
        type: "ProductSpotlight",
        props: {
          id: "tpl-sp-spot",
          productId: "",
          layout: "image_left",
          showDescription: true,
          showPrice: true,
          ctaText: "Add to Cart",
          backgroundColor: "",
        },
      },
      {
        type: "Spacer",
        props: { id: "tpl-sp-sp1", height: "md" },
      },
      // About / details rich text
      {
        type: "RichText",
        props: {
          id: "tpl-sp-about",
          content: `<h2>Why Our Customers Love It</h2>
<p>We started with one simple idea: create something Afghans can be proud of. No shortcuts. No compromise on quality. Just honest craftsmanship at a fair price.</p>
<p>Every order is carefully packed and delivered with care — whether you're in Kabul, Herat, Mazar, or anywhere across Afghanistan.</p>`,
          maxWidth: "medium",
          padding: "large",
        },
      },
      // Social proof — testimonials
      {
        type: "Testimonials",
        props: {
          id: "tpl-sp-reviews",
          title: "What Customers Say",
          subtitle: "Honest reviews from real buyers",
          testimonials: [
            {
              id: "t1",
              authorName: "Ahmad Karimi",
              authorRole: "Verified Buyer — Kabul",
              authorImageUrl: "",
              quote:
                "Best quality I've found in Afghanistan. Delivered in 2 days and exactly as described. Will definitely order again.",
              rating: 5,
            },
            {
              id: "t2",
              authorName: "Fatima Noori",
              authorRole: "Verified Buyer — Herat",
              authorImageUrl: "",
              quote:
                "Finally a store that keeps its promises. The product is even better in person. Highly recommended.",
              rating: 5,
            },
            {
              id: "t3",
              authorName: "Khalid Ahmadzai",
              authorRole: "Verified Buyer — Kandahar",
              authorImageUrl: "",
              quote:
                "Ordered cash on delivery. No problems at all. Fast, easy, and exactly what I wanted.",
              rating: 5,
            },
          ],
          layout: "grid",
          columns: 3,
          showRating: true,
          backgroundColor: "#f8fafc",
        },
      },
      {
        type: "Spacer",
        props: { id: "tpl-sp-sp2", height: "md" },
      },
      footerSection,
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. SERVICE BUSINESS
//    For stores that sell services rather than physical products.
//    About section, services showcase, testimonials, and contact.
// ─────────────────────────────────────────────────────────────────────────────
const serviceBusiness: PageTemplate = {
  id: "service-business",
  name: "Service Business",
  description:
    "For service providers: about section, service cards, testimonials, and contact info.",
  category: "Services",
  previewColor: "#0891b2",
  data: {
    root: { props: {} },
    content: [
      headerSection,
      // Hero
      {
        type: "HeroBanner",
        props: {
          id: "tpl-svc-hero",
          imageUrl: "",
          mobileImageUrl: "",
          imageAlt: "Our services",
          title: "We're Here to Help",
          subtitle:
            "Professional services trusted by hundreds of customers across Afghanistan.",
          headingSize: "xl",
          ctaButtons: [
            { text: "Get in Touch", href: "#contact", style: "primary" },
            { text: "Our Services", href: "#services", style: "secondary" },
          ],
          overlayOpacity: 50,
          textAlignment: "center",
          contentPosition: "center",
          minHeight: "medium",
        },
      },
      // About us
      {
        type: "RichText",
        props: {
          id: "tpl-svc-about",
          content: `<h2>About Us</h2>
<p>We are a team of dedicated professionals committed to delivering quality services to our Afghan community. From Kabul to the provinces, we've been serving customers for years with honesty and integrity.</p>
<p>Our mission is simple: make quality services accessible and affordable for every Afghan.</p>`,
          maxWidth: "medium",
          padding: "large",
        },
      },
      // Service cards
      {
        type: "ContentCards",
        props: {
          id: "tpl-svc-cards",
          heading: "Our Services",
          cards: [
            {
              id: "svc-1",
              imageUrl: "",
              title: "Consultation",
              subtitle: "Expert advice tailored to your needs",
              linkUrl: "/contact",
              linkText: "Book Now",
            },
            {
              id: "svc-2",
              imageUrl: "",
              title: "Installation",
              subtitle: "Professional setup at your location",
              linkUrl: "/contact",
              linkText: "Get Quote",
            },
            {
              id: "svc-3",
              imageUrl: "",
              title: "Support",
              subtitle: "After-sale assistance when you need it",
              linkUrl: "/contact",
              linkText: "Contact Us",
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
      {
        type: "Spacer",
        props: { id: "tpl-svc-sp1", height: "md" },
      },
      // Testimonials
      {
        type: "Testimonials",
        props: {
          id: "tpl-svc-reviews",
          title: "Client Feedback",
          subtitle: "",
          testimonials: [
            {
              id: "r1",
              authorName: "Mohammad Hassan",
              authorRole: "Business Owner — Kabul",
              authorImageUrl: "",
              quote:
                "Professional, fast, and fair pricing. These guys know what they're doing and actually deliver on their promises.",
              rating: 5,
            },
            {
              id: "r2",
              authorName: "Zainab Sultani",
              authorRole: "Customer — Mazar-e-Sharif",
              authorImageUrl: "",
              quote:
                "I was skeptical at first but they exceeded my expectations. The work was clean and done on time.",
              rating: 5,
            },
          ],
          layout: "grid",
          columns: 2,
          showRating: true,
          backgroundColor: "",
        },
      },
      {
        type: "Spacer",
        props: { id: "tpl-svc-sp2", height: "md" },
      },
      // Contact info
      {
        type: "RichText",
        props: {
          id: "tpl-svc-contact",
          content: `<h2>Contact Us</h2>
<p>Ready to work with us? Reach out and we'll get back to you within a few hours.</p>
<p>📞 <strong>Call / WhatsApp:</strong> +93 700 000 000<br>
📍 <strong>Location:</strong> Kabul, Afghanistan<br>
🕐 <strong>Hours:</strong> 8:00 AM – 8:00 PM, Saturday to Thursday</p>
<p>We also accept orders via WhatsApp and phone call.</p>`,
          maxWidth: "medium",
          padding: "large",
        },
      },
      footerSection,
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. CATALOG ONLY
//    No-cart product showcase. Built for stores that take orders via
//    WhatsApp / phone. Emphasises browsing and contact over checkout.
// ─────────────────────────────────────────────────────────────────────────────
const catalogOnly: PageTemplate = {
  id: "catalog-only",
  name: "Catalog Only",
  description:
    "Product showcase without a checkout flow. Ideal for WhatsApp / phone order businesses.",
  category: "Catalog",
  previewColor: "#059669",
  data: {
    root: { props: {} },
    content: [
      headerSection,
      // Contact announcement at the top
      {
        type: "AnnouncementBar",
        props: {
          id: "tpl-cat-bar",
          text: "To order, call or WhatsApp us on +93 700 000 000",
          linkText: "WhatsApp",
          linkUrl: "https://wa.me/93700000000",
          backgroundColor: "#059669",
          textColor: "#ffffff",
          dismissible: false,
          icon: "none",
        },
      },
      // Minimal hero
      {
        type: "HeroBanner",
        props: {
          id: "tpl-cat-hero",
          imageUrl: "",
          mobileImageUrl: "",
          imageAlt: "Browse our catalog",
          title: "Browse Our Collection",
          subtitle:
            "See what we have in stock. Call or WhatsApp to place your order.",
          headingSize: "xl",
          ctaButtons: [
            { text: "View All Products", href: "/products", style: "primary" },
          ],
          overlayOpacity: 40,
          textAlignment: "center",
          contentPosition: "center",
          minHeight: "medium",
        },
      },
      // Category grid — navigate by type
      {
        type: "FeaturedCategories",
        props: {
          id: "tpl-cat-cats",
          title: "Browse by Category",
          categoryIds: [],
          layout: "grid",
          columns: 3,
          showProductCount: true,
        },
      },
      {
        type: "Spacer",
        props: { id: "tpl-cat-sp1", height: "md" },
      },
      // Full product catalog grid — show everything
      {
        type: "ProductGrid",
        props: {
          id: "tpl-cat-grid",
          title: "All Products",
          source: "all",
          productIds: [],
          categoryId: "",
          limit: 16,
          columns: 4,
          showViewAll: false,
          cardStyle: "standard",
          imageAspectRatio: "square",
          showPrice: true,
          showBadge: false,
          cardBorderRadius: "md",
          cardShadow: "none",
          hoverEffect: "scale",
          textAlign: "left",
        },
      },
      {
        type: "Spacer",
        props: { id: "tpl-cat-sp2", height: "md" },
      },
      // How to order info
      {
        type: "RichText",
        props: {
          id: "tpl-cat-howto",
          content: `<h2>How to Order</h2>
<p>Ordering is simple:</p>
<ol>
  <li>Browse the catalog above and find what you want</li>
  <li>Note down the product name or screenshot it</li>
  <li>Call or WhatsApp us on <strong>+93 700 000 000</strong></li>
  <li>We confirm availability and delivery details</li>
  <li>Pay cash on delivery — no online payment needed</li>
</ol>
<p>We deliver across Kabul and to most provinces. Delivery typically takes 1–3 days.</p>`,
          maxWidth: "medium",
          padding: "large",
        },
      },
      footerSection,
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Exported registry
// ─────────────────────────────────────────────────────────────────────────────

export const pageTemplates: PageTemplate[] = [
  modernMinimal,
  bazaarStyle,
  singleProduct,
  serviceBusiness,
  catalogOnly,
];

export function getTemplateById(id: string): PageTemplate | undefined {
  return pageTemplates.find((t) => t.id === id);
}
