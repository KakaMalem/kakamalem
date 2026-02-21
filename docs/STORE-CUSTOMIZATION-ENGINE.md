# Store Customization Engine — Implementation Plan

> **Status**: Proposed
> **Author**: Engineering
> **Last Updated**: 2026-02-19
> **Scope**: Enterprise-grade visual store builder for Kaka Malem tenants

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Industry Analysis & 2026 Trends](#2-industry-analysis--2026-trends)
3. [Architecture Overview](#3-architecture-overview)
4. [Section & Block System](#4-section--block-system)
5. [Visual Editor Integration (Puck)](#5-visual-editor-integration-puck)
6. [Section Catalog](#6-section-catalog)
7. [Theme System](#7-theme-system)
8. [Data Model & Storage](#8-data-model--storage)
9. [Rendering Pipeline](#9-rendering-pipeline)
10. [AI-Assisted Design](#10-ai-assisted-design)
11. [Performance & Optimization](#11-performance--optimization)
12. [Migration Strategy](#12-migration-strategy)
13. [Implementation Phases](#13-implementation-phases)
14. [File Structure](#14-file-structure)
15. [API Reference](#15-api-reference)
16. [Testing Strategy](#16-testing-strategy)

---

## 1. Executive Summary

### Problem

Every Kaka Malem store currently renders the same hardcoded homepage layout: sale banner → categories bar → product grid. Store owners have zero control over page structure, section ordering, hero banners, featured collections, or visual storytelling. This makes every shop on the platform look identical, which hurts brand differentiation and merchant retention.

### Solution

Build a **Section-Based Visual Editor** — inspired by Shopify Online Store 2.0's "Sections Everywhere" architecture — that lets merchants visually compose their storefront pages using drag-and-drop sections and blocks. The system uses **Puck** (MIT-licensed React visual editor) as the editing engine, a **JSON-schema driven layout model** stored per-tenant in the database, and **server-rendered output** via Next.js RSC for zero-JS storefronts.

### Key Design Decisions

| Decision           | Choice                                    | Rationale                                                                                    |
| ------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| Editor engine      | **Puck** (open-source, React-native)      | MIT license, RSC support, AI generation built-in, active maintenance, Tailwind v4 compatible |
| Architecture model | **Shopify-style sections + blocks**       | Proven at scale, merchant-friendly mental model, constrainted enough to prevent bad designs  |
| Layout storage     | **JSON in PostgreSQL (jsonb)**            | Fast reads, flexible schema, queryable, no external CMS dependency                           |
| Rendering          | **Server Components + static JSON**       | Zero client JS for visitors, fast TTFB, SEO-friendly                                         |
| Theming            | **CSS custom properties + design tokens** | Per-tenant overrides without CSS bloat, OKLCH color space (already in use)                   |
| AI integration     | **Puck AI + custom prompts**              | Generate sections from merchant descriptions, suggest layouts based on industry              |

---

## 2. Industry Analysis & 2026 Trends

### How Competitors Do It

| Platform                   | Approach                                                                      | Strengths                                          | Weaknesses                                   |
| -------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------- |
| **Shopify OS 2.0**         | Sections + Blocks via Liquid templates, JSON schema per section, theme editor | Proven at scale, huge ecosystem, merchant-friendly | Tied to Liquid, limited programmatic control |
| **Shopify Hydrogen**       | Headless React (Remix/React Router), full code control                        | Max flexibility, RSC support                       | No built-in visual editor, developer-heavy   |
| **Wix**                    | ADI (AI Design Intelligence) + manual editor, component-based                 | AI-first, very flexible                            | Performance issues, vendor lock-in           |
| **Squarespace**            | Section-based with fixed layouts per template                                 | Beautiful defaults                                 | Limited customization depth                  |
| **BigCommerce**            | Page Builder (widget-based) + Stencil themes                                  | Drag-and-drop widgets                              | Less flexible than section model             |
| **GemPages (Shopify app)** | Visual builder over Shopify, CRO-focused elements                             | AI Image-to-Layout, conversion tools               | Third-party dependency, extra cost           |

### 2026 Design Trends to Support

| Trend                           | Description                                             | How We Support It                                  |
| ------------------------------- | ------------------------------------------------------- | -------------------------------------------------- |
| **Bento Grid 2.0**              | Modular rounded cards of varying sizes (Apple-inspired) | `BentoGrid` section with configurable cell sizes   |
| **Scrollytelling**              | Products visually unbox as user scrolls, narrative flow | `StorySection` with scroll-triggered animations    |
| **Kinetic Typography**          | Headlines that stretch, animate, or move with scroll    | Typography animation options in Hero/Text sections |
| **AI Layout Generation**        | Generate page layouts from text descriptions            | Puck AI integration with store-aware prompts       |
| **Tactile Maximalism**          | Depth, material appearance (glass, clay), bounce on tap | Glassmorphism + tactile preset themes              |
| **Immersive Product Showcases** | Large hero images, video backgrounds, 360° views        | `HeroProduct` section, `VideoHero` section         |
| **Community Integration**       | UGC feeds, review walls, social proof                   | `SocialProof` section, `ReviewWall` section        |

---

## 3. Architecture Overview

### Mental Model

```
┌─────────────────────────────────────────────────┐
│                   STORE PAGE                     │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │ Section: Header (system, always present)  │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │ Section: Hero Banner                      │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐    │   │
│  │  │ Block:  │ │ Block:  │ │ Block:  │    │   │
│  │  │ Slide 1 │ │ Slide 2 │ │ Slide 3 │    │   │
│  │  └─────────┘ └─────────┘ └─────────┘    │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │ Section: Featured Categories (Bento Grid) │   │
│  │  ┌───────────────┐ ┌──────┐ ┌──────┐    │   │
│  │  │   Category 1  │ │ C2   │ │ C3   │    │   │
│  │  │   (large)     │ │(sm)  │ │(sm)  │    │   │
│  │  └───────────────┘ └──────┘ └──────┘    │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │ Section: Featured Product (Spotlight)     │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │ Section: Product Grid                     │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │ Section: Testimonials / Reviews           │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │ Section: Footer (system, always present)  │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
└─────────────────────────────────────────────────┘
```

### System Layers

```
┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                     │
│                                                          │
│  Store Visitor (RSC)          Store Editor (Client)      │
│  ┌─────────────────┐        ┌─────────────────────┐    │
│  │ <Render>         │        │ <Puck>               │    │
│  │  config={config} │        │  config={config}     │    │
│  │  data={pageData} │        │  data={pageData}     │    │
│  │ />               │        │  onPublish={save}    │    │
│  └─────────────────┘        │ />                   │    │
│                              └─────────────────────┘    │
├─────────────────────────────────────────────────────────┤
│                    SECTION REGISTRY                       │
│                                                          │
│  Built-in Sections          Future: Community Sections   │
│  ├── HeroBanner             ├── (user-submitted)         │
│  ├── FeaturedCategories     └── (marketplace)            │
│  ├── ProductGrid                                         │
│  ├── ProductSpotlight                                    │
│  ├── BentoGrid                                           │
│  ├── Testimonials                                        │
│  ├── RichText                                            │
│  ├── ImageGallery                                        │
│  ├── VideoHero                                           │
│  ├── Newsletter                                          │
│  ├── StoreInfo                                           │
│  └── Spacer                                              │
├─────────────────────────────────────────────────────────┤
│                    DATA LAYER                             │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ page_layouts │  │ tenants      │  │ products/     │  │
│  │ (jsonb)      │  │ (theme_config│  │ categories    │  │
│  │              │  │  jsonb)      │  │ (live data)   │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Section & Block System

### Core Concepts

Following Shopify's proven mental model:

| Concept     | Description                                   | Example                                      |
| ----------- | --------------------------------------------- | -------------------------------------------- |
| **Page**    | A full page layout (homepage, about, contact) | Store homepage                               |
| **Section** | A full-width horizontal band on the page      | Hero banner, product grid                    |
| **Block**   | A configurable element inside a section       | A single slide in a carousel, a product card |
| **Field**   | A configurable property on a section or block | Image URL, heading text, background color    |

### Section Schema Definition

Every section declares its configuration via a typed schema:

```typescript
// lib/store-builder/sections/types.ts

interface SectionSchema {
  /** Unique identifier */
  type: string;

  /** Display name in editor */
  label: string;

  /** Category for grouping in section picker */
  category:
    | "hero"
    | "products"
    | "content"
    | "social"
    | "media"
    | "layout"
    | "commerce";

  /** Thumbnail for section picker */
  thumbnail: string;

  /** Description for section picker */
  description: string;

  /** Max instances per page (0 = unlimited) */
  maxPerPage?: number;

  /** Which page types this section can appear on */
  allowedPages?: ("home" | "product" | "category" | "about" | "custom")[];

  /** Puck ComponentConfig fields */
  fields: Record<string, FieldConfig>;

  /** Default prop values */
  defaultProps: Record<string, unknown>;

  /** The React component that renders this section */
  render: React.ComponentType<SectionProps>;
}
```

### Field Types

Support all Puck field types plus custom e-commerce fields:

```typescript
type FieldConfig =
  // Puck built-in
  | { type: "text"; label: string }
  | { type: "textarea"; label: string }
  | { type: "number"; label: string; min?: number; max?: number }
  | {
      type: "select";
      label: string;
      options: { label: string; value: string }[];
    }
  | {
      type: "radio";
      label: string;
      options: { label: string; value: string }[];
    }
  | { type: "custom"; label: string; render: React.ComponentType }

  // Custom e-commerce fields (rendered via Puck custom fields)
  | { type: "image-picker"; label: string } // Opens media library
  | { type: "product-picker"; label: string; max?: number } // Select products
  | { type: "category-picker"; label: string; max?: number } // Select categories
  | { type: "color"; label: string } // Color picker (OKLCH)
  | { type: "spacing"; label: string } // Padding/margin controls
  | { type: "rich-text"; label: string } // TipTap editor inline
  | { type: "link"; label: string }; // URL + text + target
```

---

## 5. Visual Editor Integration (Puck)

### Why Puck

| Requirement                     | Puck Support                       |
| ------------------------------- | ---------------------------------- |
| MIT license (commercial use)    | Yes                                |
| React 19 support                | Yes (since 0.17)                   |
| Next.js App Router / RSC        | Yes (native support)               |
| Tailwind CSS v4                 | Yes (documented recipe)            |
| Drag-and-drop sections          | Yes (core feature)                 |
| Nested blocks (DropZones/Slots) | Yes (Slots API since 0.19)         |
| Custom field types              | Yes (custom field renderers)       |
| AI page generation              | Yes (Puck AI since 0.21)           |
| Real-time preview               | Yes (built-in iframe preview)      |
| Headless rendering              | Yes (`<Render>` component for RSC) |
| Data model (JSON)               | Yes (simple JSON in/out)           |
| Plugin system                   | Yes (since 0.21)                   |

### Editor Page Route

```
app/dashboard/[slug]/editor/
├── page.tsx              # Editor loader (RSC - fetches data)
├── editor-client.tsx     # Puck editor wrapper (client component)
├── preview/
│   └── route.tsx         # Preview iframe endpoint
└── [pageType]/
    └── page.tsx          # Edit specific page type
```

### Puck Configuration

```typescript
// lib/store-builder/config.ts
import type { Config } from "@measured/puck";
import { sectionRegistry } from "./sections";

export function createEditorConfig(tenant: Tenant): Config {
  return {
    root: {
      fields: {
        title: { type: "text", label: "Page Title" },
        description: { type: "textarea", label: "Meta Description" },
      },
      render: ({ children, title }) => (
        <div className="storefront-page">
          {children}
        </div>
      ),
    },
    components: sectionRegistry.toPuckComponents(tenant),
    // Categories for grouping in the component picker
    categories: {
      hero: { title: "Hero & Banners", visible: true },
      products: { title: "Products", visible: true },
      content: { title: "Content", visible: true },
      social: { title: "Social Proof", visible: true },
      media: { title: "Media", visible: true },
      layout: { title: "Layout", visible: true },
      commerce: { title: "Commerce", visible: true },
    },
  };
}
```

### Editor Client Component

```typescript
// app/dashboard/[slug]/editor/editor-client.tsx
"use client";

import { Puck } from "@measured/puck";
import "@measured/puck/puck.css";
import { createEditorConfig } from "@/lib/store-builder/config";
import { savePageLayout } from "@/lib/actions/store-builder";

export function StoreEditor({
  tenant,
  pageType,
  initialData
}: EditorProps) {
  const config = createEditorConfig(tenant);

  return (
    <Puck
      config={config}
      data={initialData}
      onPublish={async (data) => {
        await savePageLayout(tenant.id, pageType, data);
      }}
      plugins={[/* AI plugin, analytics plugin */]}
      overrides={{
        // Custom header with preview/publish buttons
        header: ({ actions }) => (
          <EditorHeader
            tenant={tenant}
            pageType={pageType}
            actions={actions}
          />
        ),
      }}
    />
  );
}
```

### Rendering for Visitors (Zero JS)

```typescript
// lib/store-builder/renderer.tsx
import { Render } from "@measured/puck";
import { createEditorConfig } from "./config";

// This is a SERVER COMPONENT - no client JS shipped
export async function StorefrontRenderer({
  tenant,
  pageType
}: RendererProps) {
  const config = createEditorConfig(tenant);
  const pageData = await getPageLayout(tenant.id, pageType);

  if (!pageData) {
    return <DefaultStorefront tenant={tenant} />;
  }

  // Puck's <Render> works in RSC - outputs pure HTML
  return <Render config={config} data={pageData} />;
}
```

---

## 6. Section Catalog

### Phase 1 — Core Sections (MVP)

These sections cover the most requested customization needs:

#### 6.1 HeroBanner

Full-width hero with image/video background, overlay text, and CTA buttons.

```typescript
{
  type: "HeroBanner",
  category: "hero",
  fields: {
    layout: {
      type: "select",
      options: [
        { label: "Full Width Image", value: "full" },
        { label: "Split (Image + Text)", value: "split" },
        { label: "Centered Text Overlay", value: "centered" },
        { label: "Video Background", value: "video" },
      ]
    },
    backgroundImage: { type: "image-picker" },
    videoUrl: { type: "text" },  // YouTube/upload
    heading: { type: "text", label: "Heading" },
    subheading: { type: "text", label: "Subheading" },
    ctaText: { type: "text", label: "Button Text" },
    ctaLink: { type: "link", label: "Button Link" },
    overlayOpacity: { type: "number", min: 0, max: 100 },
    overlayColor: { type: "color" },
    height: {
      type: "select",
      options: [
        { label: "Small (300px)", value: "sm" },
        { label: "Medium (500px)", value: "md" },
        { label: "Large (700px)", value: "lg" },
        { label: "Full Screen", value: "full" },
      ]
    },
    textAlign: { type: "radio", options: ["left", "center", "right"] },
  },
  maxPerPage: 3,
}
```

#### 6.2 FeaturedCategories

Display store categories as visual cards.

```typescript
{
  type: "FeaturedCategories",
  category: "commerce",
  fields: {
    layout: {
      type: "select",
      options: [
        { label: "Grid (Equal)", value: "grid" },
        { label: "Bento Grid", value: "bento" },
        { label: "Horizontal Scroll", value: "scroll" },
        { label: "Masonry", value: "masonry" },
        { label: "Circular Icons", value: "circular" },
      ]
    },
    categories: { type: "category-picker", max: 12 },
    showProductCount: { type: "radio", options: ["show", "hide"] },
    columns: { type: "select", options: ["2", "3", "4", "6"] },
    heading: { type: "text", label: "Section Heading" },
    cardStyle: {
      type: "select",
      options: [
        { label: "Image with Overlay Text", value: "overlay" },
        { label: "Image Above, Text Below", value: "below" },
        { label: "Minimal (Text Only)", value: "minimal" },
      ]
    },
    cardRadius: { type: "select", options: ["none", "sm", "md", "lg", "full"] },
  }
}
```

#### 6.3 ProductGrid

Configurable product display with filtering.

```typescript
{
  type: "ProductGrid",
  category: "products",
  fields: {
    source: {
      type: "select",
      options: [
        { label: "All Products", value: "all" },
        { label: "Hand-Picked", value: "manual" },
        { label: "By Category", value: "category" },
        { label: "Best Sellers", value: "best_sellers" },
        { label: "New Arrivals", value: "newest" },
        { label: "On Sale", value: "on_sale" },
      ]
    },
    products: { type: "product-picker", max: 24 },  // When source=manual
    category: { type: "category-picker", max: 1 },  // When source=category
    limit: { type: "number", min: 2, max: 24 },
    columns: { type: "select", options: ["2", "3", "4"] },
    heading: { type: "text" },
    showViewAll: { type: "radio", options: ["show", "hide"] },
    cardVariant: {
      type: "select",
      options: [
        { label: "Standard", value: "standard" },
        { label: "Compact", value: "compact" },
        { label: "Detailed (with description)", value: "detailed" },
        { label: "Minimal (image + price)", value: "minimal" },
      ]
    },
  }
}
```

#### 6.4 ProductSpotlight

Feature a single product with a large image and details — the exact use case you described.

```typescript
{
  type: "ProductSpotlight",
  category: "products",
  fields: {
    product: { type: "product-picker", max: 1 },
    layout: {
      type: "select",
      options: [
        { label: "Image Left, Details Right", value: "split-left" },
        { label: "Image Right, Details Left", value: "split-right" },
        { label: "Full Width Image + Details Below", value: "full-below" },
        { label: "Centered Showcase", value: "centered" },
      ]
    },
    imageSize: {
      type: "select",
      options: [
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
      ]
    },
    showPrice: { type: "radio", options: ["show", "hide"] },
    showDescription: { type: "radio", options: ["show", "hide"] },
    showAddToCart: { type: "radio", options: ["show", "hide"] },
    backgroundStyle: {
      type: "select",
      options: [
        { label: "White", value: "white" },
        { label: "Light Gray", value: "gray" },
        { label: "Custom Color", value: "custom" },
        { label: "Gradient", value: "gradient" },
      ]
    },
    backgroundColor: { type: "color" },
    heading: { type: "text", label: "Optional Section Heading" },
  }
}
```

#### 6.5 BentoGrid

The 2026 trending layout — mixed-size cards in a grid.

```typescript
{
  type: "BentoGrid",
  category: "layout",
  fields: {
    preset: {
      type: "select",
      options: [
        { label: "1 Large + 2 Small", value: "1-2" },
        { label: "2 Medium + 2 Small", value: "2-2" },
        { label: "1 Large + 4 Small", value: "1-4" },
        { label: "3 Equal", value: "3" },
        { label: "Asymmetric (2 rows)", value: "asymmetric" },
      ]
    },
    // Each cell is a slot that can contain: image, product, category, or text
    cells: {
      type: "slot",  // Puck Slots API — each cell is a drop zone
    },
    gap: { type: "select", options: ["none", "sm", "md", "lg"] },
    borderRadius: { type: "select", options: ["none", "sm", "md", "lg"] },
  }
}
```

#### 6.6 RichText

Free-form text content with TipTap.

```typescript
{
  type: "RichText",
  category: "content",
  fields: {
    content: { type: "rich-text" },
    maxWidth: { type: "select", options: ["sm", "md", "lg", "full"] },
    textAlign: { type: "radio", options: ["left", "center", "right"] },
    padding: { type: "spacing" },
  }
}
```

#### 6.7 ImageGallery

Visual media display.

```typescript
{
  type: "ImageGallery",
  category: "media",
  fields: {
    images: { type: "image-picker" },  // Multi-select
    layout: {
      type: "select",
      options: [
        { label: "Grid", value: "grid" },
        { label: "Masonry", value: "masonry" },
        { label: "Carousel", value: "carousel" },
        { label: "Lightbox Grid", value: "lightbox" },
      ]
    },
    columns: { type: "select", options: ["2", "3", "4"] },
    aspectRatio: { type: "select", options: ["square", "landscape", "portrait", "auto"] },
  }
}
```

#### 6.8 Testimonials

Social proof section.

```typescript
{
  type: "Testimonials",
  category: "social",
  fields: {
    source: {
      type: "select",
      options: [
        { label: "Manual (enter testimonials)", value: "manual" },
        { label: "From Product Reviews", value: "reviews" },
      ]
    },
    layout: {
      type: "select",
      options: [
        { label: "Carousel", value: "carousel" },
        { label: "Grid", value: "grid" },
        { label: "Stacked", value: "stacked" },
      ]
    },
    // Manual testimonials are blocks (Puck Slots)
    testimonials: { type: "slot" },
    showRating: { type: "radio", options: ["show", "hide"] },
    showAvatar: { type: "radio", options: ["show", "hide"] },
  }
}
```

#### 6.9 Spacer / Divider

```typescript
{
  type: "Spacer",
  category: "layout",
  fields: {
    height: { type: "number", min: 8, max: 200, label: "Height (px)" },
    showDivider: { type: "radio", options: ["none", "line", "dots", "gradient"] },
    maxWidth: { type: "select", options: ["sm", "md", "lg", "full"] },
  }
}
```

#### 6.10 AnnouncementBar

Top-of-page promotional banner.

```typescript
{
  type: "AnnouncementBar",
  category: "commerce",
  fields: {
    text: { type: "text" },
    link: { type: "link" },
    backgroundColor: { type: "color" },
    textColor: { type: "color" },
    dismissible: { type: "radio", options: ["yes", "no"] },
    icon: { type: "select", options: ["none", "truck", "tag", "gift", "star"] },
  },
  maxPerPage: 1,
}
```

### Phase 2 — Enterprise Sections (Implemented)

These sections enable enterprise-level storefronts (GymShark-quality homepages):

#### 6.11 VideoHero

Full-width hero with video/image backgrounds, separate mobile/desktop sources, multi-CTA buttons.

```typescript
{
  type: "VideoHero",
  category: "hero",
  fields: {
    mediaType: { type: "radio", options: ["image", "video"] },
    imageUrl: { type: "image-picker" },
    mobileImageUrl: { type: "image-picker" },
    videoUrl: { type: "text" },
    mobileVideoUrl: { type: "text" },
    videoPosterUrl: { type: "image-picker" },
    autoplay: { type: "radio", options: [true, false] },
    loop: { type: "radio", options: [true, false] },
    muted: { type: "radio", options: [true, false] },
    overlayOpacity: { type: "number", min: 0, max: 100 },
    overlayColor: { type: "color" },
    heading: { type: "text" },
    subheading: { type: "textarea" },
    headingSize: { type: "select", options: ["md", "lg", "xl", "2xl"] },
    textAlign: { type: "radio", options: ["left", "center", "right"] },
    textColor: { type: "radio", options: ["light", "dark"] },
    overlayImageUrl: { type: "image-picker" },
    ctaButtons: { type: "custom", render: "CTAButtonsField" },  // Up to 3 buttons
    height: { type: "select", options: ["sm", "md", "lg", "full"] },
    contentPosition: { type: "select", options: ["left", "center", "right", "bottom-left", "bottom-center"] },
  },
}
```

**Implementation:** Uses native `<video>` with `autoPlay muted loop playsInline`. Separate mobile/desktop videos via CSS `hidden sm:block`. Poster attribute for fast initial paint.

#### 6.12 ProductCarousel

Horizontal scrollable product carousel with Embla Carousel, prev/next arrows, subtitle, "view all" link.

```typescript
{
  type: "ProductCarousel",
  category: "products",
  fields: {
    heading: { type: "text" },
    subtitle: { type: "text" },
    source: { type: "select", options: ["newest", "all", "manual", "category", "on_sale", "best_sellers"] },
    productIds: { type: "product-picker" },
    categoryId: { type: "category-picker" },
    limit: { type: "number", min: 4, max: 20 },
    showViewAll: { type: "radio" },
    viewAllUrl: { type: "text" },
    slidesPerView: { type: "select", options: ["2", "3", "4"] },
    showArrows: { type: "radio" },
    cardStyle: { type: "select", options: ["standard", "compact", "minimal"] },
    backgroundColor: { type: "color" },
    textColor: { type: "radio", options: ["dark", "light"] },
  },
}
```

**Implementation:** Uses `embla-carousel-react` via shadcn/ui `<Carousel>`. Shows partial next slide on mobile (80% basis). Inline product card with hover image swap.

#### 6.13 CollectionTabs

Tabbed content carousel with image cards organized by tabs (e.g., "Women" / "Men").

```typescript
{
  type: "CollectionTabs",
  category: "categories",
  fields: {
    heading: { type: "text" },
    tabs: { type: "custom", render: "TabsField" },  // Array of { label, cards[] }
    layout: { type: "radio", options: ["grid", "carousel"] },
    columns: { type: "select", options: ["2", "3", "4"] },
    cardStyle: { type: "radio", options: ["overlay", "below"] },
    gap: { type: "select", options: ["sm", "md", "lg"] },
    backgroundColor: { type: "color" },
  },
}
```

**Implementation:** Client component with `useState` for active tab. Each tab has up to 8 cards with image, title, subtitle, link. Separate mobile image support.

#### 6.14 MarqueeBar

Continuously scrolling trust/USP bar (e.g., "FREE DELIVERY • 60 DAY RETURNS").

```typescript
{
  type: "MarqueeBar",
  category: "promotions",
  fields: {
    items: { type: "custom", render: "MarqueeItemsField" },  // Array of { text, icon, href }
    speed: { type: "select", options: ["slow", "normal", "fast"] },
    direction: { type: "radio", options: ["left", "right"] },
    backgroundColor: { type: "color" },
    textColor: { type: "color" },
    pauseOnHover: { type: "radio" },
    fontSize: { type: "select", options: ["xs", "sm", "md"] },
    separator: { type: "select", options: ["dot", "pipe", "star", "none"] },
  },
}
```

**Implementation:** Pure CSS `@keyframes marquee` animation — zero JS runtime cost. Duplicated track for seamless infinite scroll.

#### 6.15 ContentCards

Grid/carousel of large media cards linking to collections or categories.

```typescript
{
  type: "ContentCards",
  category: "media",
  fields: {
    heading: { type: "text" },
    cards: { type: "custom", render: "CardListField" },  // Array of ContentCard
    layout: { type: "radio", options: ["grid", "carousel"] },
    columns: { type: "select", options: ["2", "3", "4"] },
    gap: { type: "select", options: ["none", "sm", "md", "lg"] },
    cardStyle: { type: "select", options: ["overlay-bottom", "overlay-center", "below"] },
    overlayGradient: { type: "radio" },
    backgroundColor: { type: "color" },
  },
}
```

**Implementation:** Three card style variants (overlay-bottom, overlay-center, below). Supports carousel layout via Embla. Mobile image support per card.

### Phase 2b — Planned Sections

| Section            | Description                                                 |
| ------------------ | ----------------------------------------------------------- |
| `CountdownTimer`   | Sale countdown with urgency styling                         |
| `BrandLogos`       | Trust bar with partner/brand logos                          |
| `FAQ`              | Accordion-style FAQ section                                 |
| `ContactForm`      | Embeddable contact form                                     |
| `MapSection`       | Store location with Leaflet map                             |
| `SocialFeed`       | Instagram/TikTok feed embed                                 |
| `NewsletterSignup` | Email collection with customizable design                   |
| `ComparisonTable`  | Product comparison grid                                     |
| `StorySection`     | Scroll-triggered narrative with images + text               |
| `BeforeAfter`      | Image comparison slider (great for beauty/renovation shops) |

### Phase 3 — Dynamic / Data-Driven Sections

| Section             | Description                                     |
| ------------------- | ----------------------------------------------- |
| `RecentlyViewed`    | Products the customer recently viewed           |
| `PersonalizedPicks` | AI-recommended products based on behavior       |
| `TrendingNow`       | Products trending in the store (order velocity) |
| `LiveActivityFeed`  | "X just purchased Y" social proof ticker        |

---

## 7. Theme System

### Design Tokens

Each tenant can customize a set of design tokens that cascade to all sections:

```typescript
// lib/store-builder/themes/types.ts

interface ThemeConfig {
  // Colors (OKLCH)
  colors: {
    primary: string; // Brand primary (buttons, links)
    primaryForeground: string;
    secondary: string; // Secondary accent
    secondaryForeground: string;
    background: string; // Page background
    foreground: string; // Default text
    muted: string; // Muted backgrounds
    mutedForeground: string;
    accent: string; // Highlights
    border: string; // Border color
    card: string; // Card background
    cardForeground: string;
  };

  // Typography
  typography: {
    headingFont: string; // Google Fonts family
    bodyFont: string; // Google Fonts family
    baseSize: number; // 14, 16, 18
    headingWeight: "400" | "500" | "600" | "700" | "800";
    lineHeight: "tight" | "normal" | "relaxed";
  };

  // Shape
  shape: {
    borderRadius: "none" | "sm" | "md" | "lg" | "full";
    buttonStyle: "sharp" | "rounded" | "pill";
    cardShadow: "none" | "sm" | "md" | "lg";
  };

  // Layout
  layout: {
    maxWidth: "1024" | "1152" | "1280" | "1440";
    sectionSpacing: "compact" | "normal" | "spacious";
    headerStyle: "default" | "transparent" | "sticky-minimal";
  };
}
```

### Theme Presets

Provide starting points that merchants can customize:

| Preset      | Style                                         | Use Case                |
| ----------- | --------------------------------------------- | ----------------------- |
| **Clean**   | White, minimal, lots of whitespace            | Fashion, lifestyle      |
| **Bold**    | Dark backgrounds, large type, high contrast   | Streetwear, tech        |
| **Warm**    | Cream/beige tones, serif headings             | Artisan, food, handmade |
| **Fresh**   | Bright colors, rounded shapes, playful        | Youth, accessories      |
| **Pro**     | Gray tones, sharp edges, structured           | Electronics, B2B        |
| **Elegant** | Deep colors, gold accents, refined typography | Jewelry, luxury         |

### Theme Application

Themes are applied as CSS custom properties at the store layout level:

```typescript
// app/store/[slug]/(storefront)/layout.tsx

export default async function StoreLayout({ params, children }) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  const theme = tenant.themeConfig ?? DEFAULT_THEME;

  return (
    <div style={themeToCSS(theme)}>
      {children}
    </div>
  );
}

function themeToCSS(theme: ThemeConfig): React.CSSProperties {
  return {
    '--primary': theme.colors.primary,
    '--primary-foreground': theme.colors.primaryForeground,
    '--background': theme.colors.background,
    '--foreground': theme.colors.foreground,
    // ... all tokens as CSS custom properties
    '--heading-font': theme.typography.headingFont,
    '--body-font': theme.typography.bodyFont,
    '--radius': radiusMap[theme.shape.borderRadius],
    // etc.
  } as React.CSSProperties;
}
```

---

## 8. Data Model & Storage

### Database Schema Changes

```sql
-- New table: page_layouts
-- Stores the Puck JSON data for each page of each tenant

CREATE TABLE page_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Page identification
  page_type VARCHAR(50) NOT NULL,  -- 'home', 'about', 'contact', 'custom'
  page_slug VARCHAR(255),          -- For custom pages: '/my-custom-page'
  page_title VARCHAR(255),         -- Display title for custom pages

  -- Layout data (Puck Data JSON)
  published_data JSONB,            -- Live/published version
  draft_data JSONB,                -- Work-in-progress draft

  -- Metadata
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),

  -- Ensure one layout per page per tenant
  UNIQUE(tenant_id, page_type, page_slug)
);

CREATE INDEX idx_page_layouts_tenant ON page_layouts(tenant_id);
CREATE INDEX idx_page_layouts_lookup ON page_layouts(tenant_id, page_type, page_slug);

-- Add theme config to tenants table
ALTER TABLE tenants ADD COLUMN theme_config JSONB DEFAULT '{}';

-- Page layout version history (for undo/rollback)
CREATE TABLE page_layout_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_layout_id UUID NOT NULL REFERENCES page_layouts(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  UNIQUE(page_layout_id, version_number)
);

CREATE INDEX idx_layout_versions ON page_layout_versions(page_layout_id, version_number DESC);
```

### Drizzle Schema

```typescript
// In lib/db/schema.ts (additions)

export const pageLayouts = pgTable(
  "page_layouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    pageType: varchar("page_type", { length: 50 }).notNull(),
    pageSlug: varchar("page_slug", { length: 255 }),
    pageTitle: varchar("page_title", { length: 255 }),

    publishedData: jsonb("published_data"),
    draftData: jsonb("draft_data"),

    isPublished: boolean("is_published").default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
  },
  (table) => [
    uniqueIndex("page_layouts_tenant_page").on(
      table.tenantId,
      table.pageType,
      table.pageSlug
    ),
    index("idx_page_layouts_tenant").on(table.tenantId),
  ]
);

export const pageLayoutVersions = pgTable(
  "page_layout_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pageLayoutId: uuid("page_layout_id")
      .notNull()
      .references(() => pageLayouts.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
  },
  (table) => [
    uniqueIndex("layout_version_unique").on(
      table.pageLayoutId,
      table.versionNumber
    ),
  ]
);
```

### Puck Data Shape (stored in `published_data` / `draft_data`)

```json
{
  "root": {
    "props": {
      "title": "My Store Homepage",
      "description": "Welcome to my store"
    }
  },
  "content": [
    {
      "type": "HeroBanner",
      "props": {
        "id": "HeroBanner-abc123",
        "layout": "centered",
        "backgroundImage": "/uploads/tenant-123/hero.jpg",
        "heading": "Welcome to Our Store",
        "subheading": "Discover amazing products",
        "ctaText": "Shop Now",
        "ctaLink": { "url": "/store/my-shop/products", "text": "Shop Now" },
        "overlayOpacity": 40,
        "height": "lg"
      }
    },
    {
      "type": "FeaturedCategories",
      "props": {
        "id": "FeaturedCategories-def456",
        "layout": "bento",
        "categories": ["cat-uuid-1", "cat-uuid-2", "cat-uuid-3"],
        "heading": "Shop by Category",
        "cardStyle": "overlay",
        "columns": "3"
      }
    },
    {
      "type": "ProductSpotlight",
      "props": {
        "id": "ProductSpotlight-ghi789",
        "product": "product-uuid-1",
        "layout": "split-left",
        "imageSize": "xl",
        "showPrice": "show",
        "showAddToCart": "show"
      }
    },
    {
      "type": "ProductGrid",
      "props": {
        "id": "ProductGrid-jkl012",
        "source": "newest",
        "limit": 8,
        "columns": "4",
        "heading": "New Arrivals",
        "showViewAll": "show"
      }
    }
  ],
  "zones": {}
}
```

---

## 9. Rendering Pipeline

### Storefront Page Rendering (Visitor-Facing)

```
Browser Request: GET /store/my-shop
        │
        ▼
┌─────────────────────────┐
│ app/store/[slug]/page.tsx│  (RSC — Server Component)
│                          │
│ 1. Resolve tenant        │
│ 2. Fetch page_layout     │
│    WHERE tenant_id = X   │
│    AND page_type = 'home'│
│    AND is_published      │
│                          │
│ 3. If layout exists:     │──── Yes ──▶ Render with Puck <Render>
│                          │            (server-side, zero JS)
│    If no layout:         │──── No ───▶ Render DefaultStorefront
│                          │            (current hardcoded layout)
└─────────────────────────┘
```

### Data Resolution for Dynamic Sections

Sections like `ProductGrid` and `FeaturedCategories` reference live data (product IDs, category IDs). This data must be resolved at render time:

```typescript
// lib/store-builder/resolvers.ts

/**
 * Puck's resolveData runs server-side for each component.
 * We use it to hydrate product/category references with fresh data.
 */
export function createProductGridResolver(tenantId: string) {
  return async (data: ComponentData, params: ResolveParams) => {
    const { source, products, category, limit } = data.props;

    let resolvedProducts;
    switch (source) {
      case "manual":
        resolvedProducts = await getProductsByIds(tenantId, products);
        break;
      case "category":
        resolvedProducts = await getProductsByCategory(
          tenantId,
          category[0],
          limit
        );
        break;
      case "newest":
        resolvedProducts = await getNewestProducts(tenantId, limit);
        break;
      case "best_sellers":
        resolvedProducts = await getBestSellingProducts(tenantId, limit);
        break;
      case "on_sale":
        resolvedProducts = await getOnSaleProducts(tenantId, limit);
        break;
      default:
        resolvedProducts = await getActiveProducts(tenantId, limit);
    }

    return {
      props: { ...data.props, _resolvedProducts: resolvedProducts },
      readOnly: { _resolvedProducts: true },
    };
  };
}
```

### Caching Strategy

```
Page Layout JSON   →  Cached in DB (changes only on publish)
Product Data       →  React cache() per request (same as current)
Theme Config       →  Cached on tenant object (already loaded)
Section Components →  Static imports (no runtime loading)
```

For frequently accessed stores, add a Redis/in-memory cache layer for `published_data`:

```typescript
// lib/store-builder/cache.ts

const layoutCache = new Map<string, { data: PuckData; expiry: number }>();
const CACHE_TTL = 60_000; // 1 minute

export async function getCachedLayout(
  tenantId: string,
  pageType: string
): Promise<PuckData | null> {
  const key = `${tenantId}:${pageType}`;
  const cached = layoutCache.get(key);

  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  const layout = await db.query.pageLayouts.findFirst({
    where: and(
      eq(pageLayouts.tenantId, tenantId),
      eq(pageLayouts.pageType, pageType),
      eq(pageLayouts.isPublished, true)
    ),
  });

  if (layout?.publishedData) {
    layoutCache.set(key, {
      data: layout.publishedData as PuckData,
      expiry: Date.now() + CACHE_TTL,
    });
    return layout.publishedData as PuckData;
  }

  return null;
}

export function invalidateLayoutCache(tenantId: string, pageType: string) {
  layoutCache.delete(`${tenantId}:${pageType}`);
}
```

---

## 10. AI-Assisted Design

### Puck AI Integration

Puck 0.21+ ships with AI page generation. We integrate it with store-aware context:

```typescript
// lib/store-builder/ai/generate.ts

export async function generateStoreLayout(
  tenant: Tenant,
  prompt: string,
  pageType: string
): Promise<PuckData> {
  const context = buildStoreContext(tenant);

  const systemPrompt = `
    You are designing a ${pageType} page for an online store.

    Store info:
    - Name: ${tenant.name}
    - Category: ${context.storeCategory}
    - Products: ${context.productCount} products in ${context.categoryCount} categories
    - Top categories: ${context.topCategories.join(", ")}
    - Has hero images: ${context.hasHeroImages}

    Available sections: ${SECTION_CATALOG.map((s) => s.type).join(", ")}

    Generate a JSON layout using the Puck data format.
    The merchant said: "${prompt}"
  `;

  // Use Puck's AI generation API
  return await puckAI.generate({
    config: createEditorConfig(tenant),
    prompt: systemPrompt,
  });
}
```

### AI Features for Merchants

| Feature                       | Description                                                                |
| ----------------------------- | -------------------------------------------------------------------------- |
| **Generate from description** | "I sell handmade jewelry, make my homepage elegant" → generates layout     |
| **Suggest sections**          | Based on store category and product catalog, suggest which sections to add |
| **Auto-fill content**         | Pre-populate headings, descriptions from store data                        |
| **Layout optimization**       | Suggest layout improvements based on industry best practices               |
| **Image suggestions**         | Suggest which product images work best for hero sections                   |

---

## 11. Performance & Optimization

### Core Web Vitals Targets

| Metric  | Target  | Strategy                                                          |
| ------- | ------- | ----------------------------------------------------------------- |
| **LCP** | < 2.5s  | Preload hero images, server-render all sections                   |
| **CLS** | < 0.1   | Fixed section heights, aspect-ratio on images, font-display: swap |
| **INP** | < 200ms | Zero JS for static sections, lazy-load interactive sections       |

### Image Optimization

```typescript
// All section images go through Next.js Image optimization
<Image
  src={heroImage}
  alt={heading}
  fill
  priority={isFirstSection}  // LCP optimization
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
  className="object-cover"
/>
```

### Lazy Loading Sections

Below-the-fold sections use intersection observer:

```typescript
// Only applies to sections below the first viewport
// The first 2 sections are always server-rendered immediately

function SectionWrapper({ index, children }: { index: number; children: React.ReactNode }) {
  if (index < 2) return <>{children}</>;

  return (
    <LazySection fallback={<SectionSkeleton />}>
      {children}
    </LazySection>
  );
}
```

### Bundle Impact

| Component                       | JS Size        | When Loaded                             |
| ------------------------------- | -------------- | --------------------------------------- |
| Puck Editor                     | ~150KB gzipped | Dashboard editor only (not storefront)  |
| Puck Render                     | ~5KB gzipped   | Server-side only (RSC) — zero client JS |
| Section components              | 0 KB client    | Server Components (RSC)                 |
| Interactive sections (carousel) | ~3KB each      | Lazy-loaded on interaction              |

**Key point**: Visitors see **zero additional JavaScript**. All section rendering happens server-side via RSC. Only interactive elements (carousels, accordions) ship minimal client JS.

---

## 12. Migration Strategy

### Backward Compatibility

Existing stores must continue working without any action from merchants:

1. **No layout saved** → render current hardcoded `DefaultStorefront` (zero regression)
2. **Layout saved** → render from Puck data
3. **Theme not set** → use current CSS variables (zero regression)

```typescript
// app/store/[slug]/(storefront)/page.tsx

export default async function StorePage({ params }) {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);

  // Try to load custom layout
  const layout = await getCachedLayout(tenant.id, 'home');

  if (layout) {
    // New: Render custom layout via Puck
    return <StorefrontRenderer tenant={tenant} pageType="home" />;
  }

  // Fallback: Existing hardcoded layout (100% backward compatible)
  return <DefaultStorefront tenant={tenant} />;
}
```

### Data Migration Path

No data migration needed — this is purely additive:

1. New `page_layouts` table (empty by default)
2. New `theme_config` column on `tenants` (default `{}`)
3. Existing stores render as before until owner customizes

### Migration to Custom Layout

When a merchant first opens the editor, we pre-populate the Puck data from their current (default) layout:

```typescript
export async function getOrCreatePageLayout(
  tenantId: string,
  pageType: string
): Promise<PuckData> {
  // Check for existing layout
  const existing = await db.query.pageLayouts.findFirst({
    where: and(
      eq(pageLayouts.tenantId, tenantId),
      eq(pageLayouts.pageType, pageType)
    ),
  });

  if (existing?.draftData) {
    return existing.draftData as PuckData;
  }

  // Generate default layout from current store data
  return generateDefaultLayout(tenantId, pageType);
}

async function generateDefaultLayout(
  tenantId: string,
  pageType: string
): Promise<PuckData> {
  const tenant = await getTenantById(tenantId);
  const categories = await getCategoriesWithCounts(tenantId);
  const activeCampaigns = await getActiveCampaigns(tenantId);

  const sections: ComponentData[] = [];

  // Mirror current hardcoded layout as starting point
  if (activeCampaigns.length > 0) {
    sections.push({
      type: "AnnouncementBar",
      props: {
        id: generateId(),
        text: activeCampaigns[0].name,
        backgroundColor: "#000000",
        textColor: "#ffffff",
      },
    });
  }

  if (categories.length > 0) {
    sections.push({
      type: "FeaturedCategories",
      props: {
        id: generateId(),
        layout: "scroll",
        categories: categories.slice(0, 8).map((c) => c.id),
        heading: "Categories",
        cardStyle: "overlay",
        showProductCount: "show",
      },
    });
  }

  sections.push({
    type: "ProductGrid",
    props: {
      id: generateId(),
      source: "newest",
      limit: 12,
      columns: "4",
      heading: "Products",
      showViewAll: "show",
    },
  });

  return {
    root: { props: { title: tenant.name } },
    content: sections,
    zones: {},
  };
}
```

---

## 13. Implementation Phases

### Phase 1: Foundation (2-3 weeks)

**Goal**: Section system + basic editor working for homepage.

| Task                                                                               | Est. | Priority |
| ---------------------------------------------------------------------------------- | ---- | -------- |
| Install and configure Puck                                                         | 1d   | P0       |
| Database: `page_layouts` + `page_layout_versions` tables                           | 1d   | P0       |
| Database: `theme_config` column on tenants                                         | 0.5d | P0       |
| Section registry architecture                                                      | 1d   | P0       |
| Build core sections: HeroBanner, ProductGrid, FeaturedCategories, RichText, Spacer | 3d   | P0       |
| Editor page route (`/dashboard/[slug]/editor`)                                     | 1d   | P0       |
| Custom Puck fields: image-picker, product-picker, category-picker                  | 2d   | P0       |
| Server actions: save draft, publish, revert                                        | 1d   | P0       |
| Storefront renderer with fallback                                                  | 1d   | P0       |
| Basic preview (iframe)                                                             | 0.5d | P0       |
| Mobile responsive preview toggle                                                   | 0.5d | P1       |

**Deliverable**: Merchants can drag sections onto their homepage and publish.

### Phase 2: Polish & More Sections (2 weeks)

| Task                                                    | Est. | Priority |
| ------------------------------------------------------- | ---- | -------- |
| Build: ProductSpotlight, BentoGrid, AnnouncementBar     | 2d   | P0       |
| Build: ImageGallery, Testimonials                       | 2d   | P1       |
| Theme system: design tokens + presets                   | 2d   | P0       |
| Theme editor UI in dashboard settings                   | 1d   | P0       |
| Draft/publish workflow with version history             | 1d   | P1       |
| Undo/redo in editor                                     | 0.5d | P1       |
| Section templates (pre-made section configs)            | 1d   | P1       |
| Editor UX polish (tooltips, section previews, grouping) | 1d   | P1       |

**Deliverable**: Full theming, solid editor UX, enough sections for most store types.

### Phase 3: Advanced Features (2-3 weeks)

| Task                                                             | Est. | Priority |
| ---------------------------------------------------------------- | ---- | -------- |
| Multi-page support (about, contact, custom pages)                | 2d   | P1       |
| AI layout generation (Puck AI integration)                       | 2d   | P1       |
| ~~Build: VideoHero, CollectionTabs~~ (DONE), FAQ, CountdownTimer | 3d   | P1       |
| Build: BrandLogos, NewsletterSignup, ContactForm                 | 2d   | P2       |
| Page-level SEO fields (title, description, OG image)             | 1d   | P1       |
| Version history UI (browse + restore previous versions)          | 1d   | P2       |
| Section duplication + copy/paste between pages                   | 1d   | P2       |
| Editor keyboard shortcuts                                        | 0.5d | P2       |

**Deliverable**: Full page builder with AI, multi-page support, advanced sections.

### Phase 4: Scale & Optimize (Ongoing)

| Task                                   | Est. | Priority |
| -------------------------------------- | ---- | -------- |
| Performance audit + optimization       | 2d   | P1       |
| Layout caching layer (Redis)           | 1d   | P1       |
| Analytics: track section engagement    | 2d   | P2       |
| A/B testing support (draft variants)   | 3d   | P2       |
| Community section marketplace (future) | TBD  | P3       |
| Custom CSS injection (pro plan only)   | 1d   | P2       |

---

## 14. File Structure

```
lib/page-builder/
├── config.ts                   # Puck configuration (all 16 sections registered)
├── types.ts                    # All section prop types + shared types (CTAButton, etc.)
├── templates.ts                # 7 page templates (Product Launch, Sale, Brand, Minimal, Classic, GymShark, Fashion)
├── resolve-products.ts         # Product data resolution for grids/carousels
│
components/page-builder/
├── storefront-renderer.tsx     # <StorefrontRenderer> RSC — zero Puck JS to visitors
├── root-renderer.tsx           # Puck root component
├── section-tracker.tsx         # Analytics tracking for section views
│
├── sections/                   # Section components (16 total)
│   ├── index.ts                # Re-exports for all sections
│   ├── hero-banner.tsx         # Hero with mobile image + multi-CTA (upgraded)
│   ├── video-hero.tsx          # Video/image hero with mobile sources (NEW)
│   ├── product-grid-section.tsx # Configurable product grid
│   ├── product-carousel.tsx    # Embla-based horizontal product carousel (NEW)
│   ├── product-spotlight.tsx   # Single product feature
│   ├── featured-categories.tsx # Category cards grid
│   ├── collection-tabs.tsx     # Tabbed collection cards (NEW)
│   ├── content-cards.tsx       # Media cards grid/carousel (NEW)
│   ├── marquee-bar.tsx         # Scrolling USP/trust bar (NEW)
│   ├── announcement-bar.tsx    # Dismissible announcement
│   ├── rich-text-section.tsx   # TipTap HTML content
│   ├── image-gallery.tsx       # Image grid/masonry/carousel
│   ├── testimonials-section.tsx # Social proof
│   ├── bento-grid-section.tsx  # Bento layout with drop zones
│   ├── spacer-section.tsx      # Vertical spacing
│   ├── store-header-preview.tsx # Editor-only header preview
│   └── store-footer-preview.tsx # Editor-only footer preview
│
├── fields/                     # Custom Puck field editors
│   ├── image-picker-field.tsx  # Media library image picker
│   ├── product-picker-field.tsx # Product search + select (single/multi)
│   ├── category-picker-field.tsx # Category picker
│   ├── color-field.tsx         # OKLCH color picker
│   ├── multi-image-picker-field.tsx # Multi-image picker
│   ├── testimonial-list-field.tsx # Testimonial array editor
│   ├── nav-items-field.tsx     # Navigation items editor
│   ├── header-settings-field.tsx # Header config editor
│   ├── footer-settings-field.tsx # Footer config editor
│   ├── cta-buttons-field.tsx   # Multi-CTA button editor (NEW)
│   ├── tabs-field.tsx          # Collection tabs editor (NEW)
│   ├── card-list-field.tsx     # Content cards editor (NEW)
│   └── marquee-items-field.tsx # Marquee items editor (NEW)
│
components/ui/
└── carousel.tsx                # Embla Carousel (shadcn/ui) — used by ProductCarousel, ContentCards

lib/theme/
├── layout-types.ts             # HeaderConfig, FooterConfig types + defaults

lib/db/queries/
└── page-layouts.ts             # DB queries (getProductsByIds with second image, getCategoriesByIds)

components/store/
└── product-card.tsx            # Product card with hover image swap (secondImage support)

app/dashboard/[slug]/
├── editor/
│   ├── page.tsx                # Editor loader (RSC)
│   ├── editor-client.tsx       # Puck editor (client)
│   └── [pageType]/
│       └── page.tsx            # Edit specific page
│
└── settings/
    └── theme/
        └── page.tsx            # Theme customizer UI

app/store/[slug]/(storefront)/
└── page.tsx                    # Updated: check for custom layout
```

---

## 15. API Reference

### Server Actions

```typescript
// lib/actions/store-builder.ts

/** Save draft layout (auto-saves from editor) */
savePageDraft(tenantId: string, pageType: string, data: PuckData): Promise<void>

/** Publish layout (makes it live) */
publishPageLayout(tenantId: string, pageType: string): Promise<void>

/** Revert to previous version */
revertPageLayout(tenantId: string, pageType: string, versionNumber: number): Promise<void>

/** Delete custom layout (revert to default) */
deletePageLayout(tenantId: string, pageType: string): Promise<void>

/** Save theme config */
saveThemeConfig(tenantId: string, config: ThemeConfig): Promise<void>

/** Generate layout with AI */
generateLayout(tenantId: string, pageType: string, prompt: string): Promise<PuckData>
```

### Query Functions

```typescript
// lib/db/queries/page-layouts.ts

/** Get published layout for a page */
getPublishedLayout(tenantId: string, pageType: string): Promise<PuckData | null>

/** Get draft layout for editor */
getDraftLayout(tenantId: string, pageType: string): Promise<PuckData | null>

/** Get version history */
getLayoutVersions(pageLayoutId: string, limit?: number): Promise<LayoutVersion[]>

/** Get all custom pages for a tenant */
getCustomPages(tenantId: string): Promise<PageLayout[]>
```

---

## 16. Testing Strategy

### Unit Tests

| Target              | What to Test                                |
| ------------------- | ------------------------------------------- |
| Section components  | Render with various props, snapshot tests   |
| Data resolvers      | Product/category resolution, error handling |
| Theme CSS generator | Token → CSS custom property mapping         |
| Section registry    | Registration, lookup, validation            |

### Integration Tests

| Target             | What to Test                           |
| ------------------ | -------------------------------------- |
| Save/publish flow  | Draft → publish → version created      |
| Renderer fallback  | No layout → default storefront         |
| Custom fields      | Product picker returns valid IDs       |
| Cache invalidation | Publish → cache cleared → fresh render |

### Visual Regression

| Target                      | Tool                             |
| --------------------------- | -------------------------------- |
| Each section in all layouts | Playwright screenshots           |
| Theme presets               | Compare across viewports         |
| Mobile responsiveness       | 375px, 768px, 1440px breakpoints |

### Performance

| Metric                             | Threshold |
| ---------------------------------- | --------- |
| Homepage TTFB (with custom layout) | < 200ms   |
| LCP with hero image                | < 2.5s    |
| Editor load time                   | < 3s      |
| Draft auto-save latency            | < 500ms   |

---

## Appendix A: Competitor Feature Matrix

| Feature                    | Shopify OS2    | Wix        | Squarespace | BigCommerce | **Kaka Malem (Planned)** |
| -------------------------- | -------------- | ---------- | ----------- | ----------- | ------------------------ |
| Drag-and-drop sections     | Yes            | Yes        | Limited     | Yes         | **Yes (Puck)**           |
| Per-page customization     | Yes            | Yes        | Yes         | Limited     | **Yes**                  |
| AI layout generation       | No             | Yes (ADI)  | No          | No          | **Yes (Puck AI)**        |
| Theme presets              | Yes            | Yes        | Yes         | Yes         | **Yes (6 presets)**      |
| Custom color/font          | Yes            | Yes        | Yes         | Yes         | **Yes (OKLCH tokens)**   |
| Product picker in sections | Yes            | Yes        | Yes         | Yes         | **Yes**                  |
| Version history            | Yes            | Yes        | No          | No          | **Yes**                  |
| Multi-page builder         | Yes            | Yes        | Yes         | Yes         | **Phase 3**              |
| Custom CSS                 | Yes (pro)      | Yes        | Yes         | Yes         | **Phase 4 (pro)**        |
| A/B testing                | No             | No         | No          | No          | **Phase 4**              |
| Mobile preview             | Yes            | Yes        | Yes         | Yes         | **Phase 1**              |
| Section marketplace        | Yes (themes)   | Yes (apps) | No          | No          | **Phase 4 (future)**     |
| Zero JS output             | Liquid (no JS) | Heavy JS   | Moderate JS | Moderate JS | **Yes (RSC)**            |

## Appendix B: Puck Data Model Quick Reference

```typescript
// What Puck stores/loads — this is what goes in page_layouts.published_data

interface PuckData {
  root: {
    props: Record<string, any>; // Page-level props (title, SEO)
  };
  content: Array<{
    type: string; // Section type key (e.g., "HeroBanner")
    props: {
      id: string; // Auto-generated unique ID
      [key: string]: any; // Section-specific props from fields
    };
  }>;
  zones: Record<string, ComponentData[]>; // Nested content (deprecated → slots)
}
```

## Appendix C: Section Component Template

```typescript
// lib/store-builder/sections/my-section/index.ts

import type { ComponentConfig } from "@measured/puck";
import { MySection } from "./my-section";

export const MySectionConfig: ComponentConfig = {
  label: "My Section",

  fields: {
    heading: { type: "text", label: "Heading" },
    // ... more fields
  },

  defaultProps: {
    heading: "Default Heading",
  },

  // Optional: resolve dynamic data server-side
  resolveData: async (data, { metadata }) => {
    return {
      props: data.props,
      readOnly: {},
    };
  },

  render: MySection,
};
```

```typescript
// lib/store-builder/sections/my-section/my-section.tsx

interface MySectionProps {
  heading: string;
  // ... typed props matching fields
}

export function MySection({ heading }: MySectionProps) {
  return (
    <section className="py-12 px-4">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-3xl font-bold">{heading}</h2>
        {/* Section content */}
      </div>
    </section>
  );
}
```
