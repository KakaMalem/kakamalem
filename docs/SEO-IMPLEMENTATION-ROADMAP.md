# SEO Implementation Roadmap

> Enterprise-level SEO strategy for Kaka Malem multi-tenant e-commerce platform

## Executive Summary

This document outlines the comprehensive SEO implementation strategy to ensure stores on Kaka Malem appear prominently in Google search results. It covers industry standards, enterprise platform benchmarks, emerging trends, and a phased implementation plan.

**Current State**: robots.txt, sitemap.xml, meta tags, product JSON-LD implemented
**Target State**: Full enterprise SEO stack with comprehensive structured data and automated indexing

---

## Table of Contents

1. [Why Stores Don't Appear in Google](#1-why-stores-dont-appear-in-google)
2. [Industry Standards](#2-industry-standards)
3. [How Enterprise Platforms Handle SEO](#3-how-enterprise-platforms-handle-seo)
4. [Emerging SEO Trends (2025-2026)](#4-emerging-seo-trends-2025-2026)
5. [Recommended NPM Packages](#5-recommended-npm-packages)
6. [Implementation Plan](#6-implementation-plan)
7. [Technical Specifications](#7-technical-specifications)
8. [Monitoring & Analytics](#8-monitoring--analytics)

---

## 1. Why Stores Don't Appear in Google

### Current Issues

| Issue                               | Impact                      | Priority     |
| ----------------------------------- | --------------------------- | ------------ |
| No sitemap.xml                      | Google can't discover pages | **Critical** |
| No robots.txt                       | No crawl directives         | **Critical** |
| No Google Search Console submission | Pages not indexed           | **Critical** |
| Missing canonical URLs              | Duplicate content issues    | High         |
| No breadcrumb structured data       | No rich snippets            | High         |
| No Organization/Store schema        | Missing business info       | High         |
| No category page metadata           | Category pages invisible    | Medium       |
| No hreflang for multilingual        | RTL/Dari/Pashto SEO         | Medium       |

### How Google Discovers Pages

```
1. Googlebot finds sitemap.xml → Lists all URLs
2. Googlebot crawls each URL → Reads content & metadata
3. Google indexes the page → Adds to search database
4. Users search → Google ranks and shows results
```

**Without a sitemap, Google relies on random link discovery** - this is why stores aren't appearing.

---

## 2. Industry Standards

### 2.1 Technical SEO Fundamentals

#### robots.txt (Required)

```
User-agent: *
Allow: /store/
Allow: /api/og/
Disallow: /dashboard/
Disallow: /admin/
Disallow: /api/
Allow: /api/sitemap
Disallow: /_next/
Disallow: /checkout/

Sitemap: https://kakamalem.com/sitemap.xml
```

#### sitemap.xml Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://kakamalem.com/sitemap-stores.xml</loc>
    <lastmod>2026-01-28T00:00:00Z</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://kakamalem.com/store/store-slug/sitemap.xml</loc>
    <lastmod>2026-01-28T00:00:00Z</lastmod>
  </sitemap>
  <!-- One sitemap per active store -->
</sitemapindex>
```

#### Canonical URLs

Every page must have a canonical URL:

```html
<link
  rel="canonical"
  href="https://kakamalem.com/store/my-store/product/my-product"
/>
```

### 2.2 Structured Data Requirements

#### Organization Schema (Store Level)

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Store Name",
  "url": "https://kakamalem.com/store/store-slug",
  "logo": "https://kakamalem.com/uploads/store-logo.png",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+93-XXX-XXXXXXX",
    "contactType": "customer service"
  },
  "sameAs": [
    "https://facebook.com/storepage",
    "https://instagram.com/storepage"
  ]
}
```

#### LocalBusiness Schema (For Physical Stores)

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Store Name",
  "image": "https://kakamalem.com/uploads/store-image.png",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Main Street",
    "addressLocality": "Kabul",
    "addressCountry": "AF"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 34.5553,
    "longitude": 69.2075
  },
  "openingHoursSpecification": {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"],
    "opens": "09:00",
    "closes": "18:00"
  }
}
```

#### BreadcrumbList Schema

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://kakamalem.com/store/store-slug"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Category",
      "item": "https://kakamalem.com/store/store-slug/category/category-slug"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Product Name"
    }
  ]
}
```

#### Product Schema (Enhanced)

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Product Name",
  "image": ["url1", "url2", "url3"],
  "description": "Product description",
  "sku": "SKU123",
  "brand": {
    "@type": "Brand",
    "name": "Store Name"
  },
  "offers": {
    "@type": "Offer",
    "url": "https://kakamalem.com/store/slug/product/product-slug",
    "priceCurrency": "AFN",
    "price": "1500",
    "priceValidUntil": "2026-12-31",
    "availability": "https://schema.org/InStock",
    "itemCondition": "https://schema.org/NewCondition",
    "seller": {
      "@type": "Organization",
      "name": "Store Name"
    },
    "shippingDetails": {
      "@type": "OfferShippingDetails",
      "shippingRate": {
        "@type": "MonetaryAmount",
        "value": "100",
        "currency": "AFN"
      },
      "shippingDestination": {
        "@type": "DefinedRegion",
        "addressCountry": "AF"
      }
    }
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.5",
    "reviewCount": "25"
  },
  "review": [
    {
      "@type": "Review",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": "5"
      },
      "author": {
        "@type": "Person",
        "name": "Reviewer Name"
      },
      "reviewBody": "Great product!"
    }
  ]
}
```

#### ItemList Schema (Category/Collection Pages)

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Electronics",
  "description": "Shop electronics at Store Name",
  "numberOfItems": 24,
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "url": "https://kakamalem.com/store/slug/product/product-1"
    }
  ]
}
```

### 2.3 Meta Tags Requirements

#### Essential Meta Tags

```html
<!-- Title: 50-60 characters -->
<title>Product Name - Store Name | Kaka Malem</title>

<!-- Description: 150-160 characters -->
<meta
  name="description"
  content="Buy Product Name at Store Name. High quality, fast delivery across Afghanistan. Shop now!"
/>

<!-- Canonical -->
<link
  rel="canonical"
  href="https://kakamalem.com/store/slug/product/product-slug"
/>

<!-- Open Graph -->
<meta property="og:type" content="product" />
<meta property="og:title" content="Product Name" />
<meta property="og:description" content="Product description" />
<meta
  property="og:image"
  content="https://kakamalem.com/uploads/product-image.jpg"
/>
<meta
  property="og:url"
  content="https://kakamalem.com/store/slug/product/product-slug"
/>
<meta property="og:site_name" content="Store Name" />
<meta property="product:price:amount" content="1500" />
<meta property="product:price:currency" content="AFN" />

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Product Name" />
<meta name="twitter:description" content="Product description" />
<meta
  name="twitter:image"
  content="https://kakamalem.com/uploads/product-image.jpg"
/>
```

#### Multilingual Support (RTL Languages)

```html
<!-- For stores with Dari/Pashto content -->
<html lang="fa" dir="rtl">
  <link rel="alternate" hreflang="fa" href="https://kakamalem.com/store/slug" />
  <link
    rel="alternate"
    hreflang="ps"
    href="https://kakamalem.com/store/slug?lang=ps"
  />
  <link
    rel="alternate"
    hreflang="en"
    href="https://kakamalem.com/store/slug?lang=en"
  />
  <link
    rel="alternate"
    hreflang="x-default"
    href="https://kakamalem.com/store/slug"
  />
</html>
```

---

## 3. How Enterprise Platforms Handle SEO

### 3.1 Shopify

| Feature            | Implementation                                                            |
| ------------------ | ------------------------------------------------------------------------- |
| Sitemaps           | Auto-generated `/sitemap.xml` per store with products, collections, pages |
| Structured Data    | Automatic Product, Breadcrumb, Organization JSON-LD                       |
| Canonical URLs     | Auto-generated for all pages                                              |
| Meta Tags          | Store owners can customize via admin                                      |
| Image Optimization | WebP conversion, lazy loading, srcset                                     |
| URL Structure      | `/products/`, `/collections/` clean URLs                                  |
| Google Integration | Built-in Google Search Console verification                               |
| Indexing API       | Instant indexing for new products                                         |

### 3.2 BigCommerce

| Feature          | Implementation                                             |
| ---------------- | ---------------------------------------------------------- |
| Sitemaps         | Multi-sitemap index with category, product, brand sitemaps |
| Structured Data  | Product, Review, Breadcrumb, Organization                  |
| SEO Settings     | Per-product SEO overrides, custom meta                     |
| 301 Redirects    | Built-in redirect manager                                  |
| URL Optimization | Customizable URL patterns                                  |
| AMP              | Optional AMP product pages                                 |
| Core Web Vitals  | Built-in performance monitoring                            |

### 3.3 Wix/Squarespace

| Feature        | Implementation                  |
| -------------- | ------------------------------- |
| Auto SEO       | AI-generated meta descriptions  |
| Sitemaps       | Dynamic sitemaps updated hourly |
| Search Console | One-click integration           |
| SEO Wizard     | Guided SEO setup for beginners  |
| Social Preview | Live OG/Twitter preview editor  |

### 3.4 Key Takeaways for Kaka Malem

1. **Automatic Everything**: Store owners shouldn't need to think about SEO basics
2. **Per-Store Sitemaps**: Each store gets its own sitemap for better organization
3. **Instant Indexing**: Use Google Indexing API for immediate discovery
4. **SEO Dashboard**: Let owners see SEO health and suggestions
5. **Default Optimization**: Even without customization, pages should be SEO-ready

---

## 4. Emerging SEO Trends (2025-2026)

### 4.1 AI-Powered Search (Google SGE / AI Overviews)

Google's AI Overviews are changing how results appear. To be featured:

- **Structured Data is Critical**: AI extracts from JSON-LD
- **Answer-Based Content**: Product descriptions should answer questions
- **E-E-A-T Signals**: Experience, Expertise, Authority, Trust
- **Rich Media**: High-quality images with proper alt text

### 4.2 Core Web Vitals 2024+ Thresholds

| Metric                          | Good   | Needs Improvement | Poor   |
| ------------------------------- | ------ | ----------------- | ------ |
| LCP (Largest Contentful Paint)  | ≤2.5s  | ≤4.0s             | >4.0s  |
| INP (Interaction to Next Paint) | ≤200ms | ≤500ms            | >500ms |
| CLS (Cumulative Layout Shift)   | ≤0.1   | ≤0.25             | >0.25  |

**Note**: INP replaced FID in March 2024. Must optimize for interactive responsiveness.

### 4.3 Passage Ranking & Semantic Search

Google now indexes specific passages within pages. Implications:

- **Long-form Product Descriptions**: Detailed content ranks for long-tail queries
- **FAQ Sections**: Answer common product questions
- **Semantic HTML**: Use `<article>`, `<section>`, `<aside>` properly

### 4.4 Visual Search & Lens Shopping

Google Lens is increasingly used for shopping:

- **High-Quality Product Images**: Multiple angles, lifestyle shots
- **Image Structured Data**: Alt text, image sitemaps
- **Product Image Requirements**: White background, 1200x1200 minimum

### 4.5 Video SEO for Products

Product videos improve rankings:

- **VideoObject Schema**: For product videos
- **YouTube Integration**: Embedded videos with timestamps
- **Short-Form Content**: Under 60s for mobile optimization

### 4.6 Zero-Click Optimization

Many searches result in no clicks (answers shown directly):

- **Rich Snippets**: Stars, price, availability in SERP
- **Knowledge Panel**: Organization schema for brand queries
- **FAQ Schema**: Expandable Q&A in search results

### 4.7 Local SEO for Afghan Market

Critical for physical stores in Afghanistan:

- **Google Business Profile**: Integration required
- **Local Inventory Ads**: Show nearby product availability
- **Dari/Pashto Keywords**: Local language optimization
- **Regional Schema**: Afghanistan-specific address format

---

## 5. Recommended NPM Packages

### 5.1 Core SEO Packages

#### next-sitemap (Recommended)

```bash
pnpm add next-sitemap
```

**Why**: Most popular, 500k+ weekly downloads, excellent Next.js App Router support

```typescript
// next-sitemap.config.js
/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: "https://kakamalem.com",
  generateRobotsTxt: true,
  exclude: ["/dashboard/*", "/admin/*", "/api/*"],
  robotsTxtOptions: {
    policies: [
      { userAgent: "*", allow: "/store/" },
      { userAgent: "*", disallow: "/dashboard/" },
    ],
  },
  additionalPaths: async (config) => {
    // Dynamic store/product paths from database
    return [
      /* paths */
    ];
  },
};
```

#### schema-dts (Recommended)

```bash
pnpm add schema-dts
```

**Why**: TypeScript definitions for Schema.org - type-safe structured data

```typescript
import type { Product, WithContext } from "schema-dts";

const productSchema: WithContext<Product> = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Product Name",
  // Full type checking and autocomplete
};
```

#### next-seo

```bash
pnpm add next-seo
```

**Why**: Simplifies meta tag management with React components

```tsx
import { NextSeo, ProductJsonLd } from "next-seo";

<NextSeo
  title="Product Name"
  description="Product description"
  canonical="https://kakamalem.com/store/slug/product/slug"
  openGraph={{
    type: "product",
    title: "Product Name",
    images: [{ url: "image.jpg" }],
  }}
/>;
```

### 5.2 Performance Packages (Core Web Vitals)

#### @next/bundle-analyzer

```bash
pnpm add -D @next/bundle-analyzer
```

**Why**: Identify large bundles affecting LCP

#### sharp (Already in Next.js)

Built-in image optimization. Ensure it's working:

```typescript
// next.config.ts
images: {
  formats: ['image/avif', 'image/webp'],
  deviceSizes: [640, 750, 828, 1080, 1200],
}
```

#### web-vitals

```bash
pnpm add web-vitals
```

**Why**: Measure Core Web Vitals in production

```typescript
import { onCLS, onINP, onLCP } from "web-vitals";

onCLS(console.log);
onINP(console.log);
onLCP(console.log);
```

### 5.3 Indexing & Submission

#### googleapis (Google Indexing API)

```bash
pnpm add googleapis
```

**Why**: Instant indexing for new/updated products

```typescript
import { google } from "googleapis";

const indexing = google.indexing("v3");

// Request indexing for a URL
await indexing.urlNotifications.publish({
  requestBody: {
    url: "https://kakamalem.com/store/slug/product/new-product",
    type: "URL_UPDATED",
  },
});
```

### 5.4 Content Optimization

#### reading-time

```bash
pnpm add reading-time
```

**Why**: Show reading time for blog/description content (SEO engagement signal)

#### slugify

```bash
pnpm add slugify
```

**Why**: Generate SEO-friendly URLs (already might be in use)

### 5.5 Monitoring & Analytics

#### @vercel/speed-insights

```bash
pnpm add @vercel/speed-insights
```

**Why**: Real User Monitoring for Core Web Vitals (if using Vercel)

### 5.6 Package Comparison Matrix

| Package      | Purpose       | Weekly Downloads | Next.js 15+ | Type Safe |
| ------------ | ------------- | ---------------- | ----------- | --------- |
| next-sitemap | Sitemaps      | 500k+            | Yes         | Yes       |
| next-seo     | Meta tags     | 400k+            | Yes         | Yes       |
| schema-dts   | JSON-LD types | 200k+            | Yes         | Yes       |
| googleapis   | Indexing API  | 1M+              | Yes         | Yes       |
| web-vitals   | Performance   | 2M+              | Yes         | Yes       |

---

## 6. Implementation Plan

### Phase 1: Critical Foundation (COMPLETED)

#### 1.1 robots.txt ✅

- [x] Create `app/robots.ts` with dynamic generation
- [x] Allow `/store/*` paths
- [x] Disallow `/dashboard/*`, `/admin/*`, `/api/*` (except sitemap)
- [x] Include sitemap reference

#### 1.2 Dynamic Sitemap ✅

- [x] Create sitemap at `/sitemap.xml` using Next.js native `MetadataRoute.Sitemap`
- [x] Include products, categories, store homepage
- [x] Set proper `lastmod` timestamps
- [x] Add `changefreq` and `priority` values

#### 1.3 Google Search Console

- [ ] Verify domain ownership
- [ ] Submit sitemap
- [ ] Set up indexing notifications
- [ ] Configure URL parameters

#### 1.4 Canonical URLs ✅

- [x] Add canonical to all store pages (via `generateMetadata`)
- [x] Add canonical to product pages
- [x] Add canonical to category pages

### Phase 2: Structured Data Enhancement (Week 3-4)

#### 2.1 Organization Schema

- [ ] Create `StoreStructuredData` component
- [ ] Include on store layout
- [ ] Add logo, contact, social links

#### 2.2 LocalBusiness Schema

- [ ] Add for stores with physical addresses
- [ ] Include opening hours
- [ ] Add geo coordinates

#### 2.3 BreadcrumbList Schema

- [ ] Create `BreadcrumbStructuredData` component
- [ ] Add to product pages
- [ ] Add to category pages

#### 2.4 Enhanced Product Schema

- [ ] Add `shippingDetails`
- [ ] Add `priceValidUntil`
- [ ] Add `itemCondition`
- [ ] Add individual `review` entries (not just aggregate)
- [ ] Add multiple images

#### 2.5 ItemList Schema

- [ ] Add to category pages
- [ ] Add to search results
- [ ] Include product positions

### Phase 3: Advanced SEO Features (Week 5-6)

#### 3.1 Google Indexing API

- [ ] Set up Google Cloud project
- [ ] Configure service account
- [ ] Create indexing endpoint
- [ ] Trigger on product create/update
- [ ] Implement rate limiting (200 requests/day)

#### 3.2 Image Sitemap

- [ ] Add image entries to product sitemap
- [ ] Include image title and caption
- [ ] Optimize image alt text in database

#### 3.3 Video Sitemap (Optional)

- [ ] Add VideoObject schema for product videos
- [ ] Create video sitemap if videos exist

#### 3.4 FAQ Schema

- [ ] Add FAQ component for products with Q&A
- [ ] Generate from product descriptions

### Phase 4: Multilingual SEO (Week 7-8)

#### 4.1 hreflang Implementation

- [ ] Add hreflang tags for Dari, Pashto, English
- [ ] Set up language detection
- [ ] Configure x-default

#### 4.2 RTL Optimization

- [ ] Ensure `dir="rtl"` for RTL stores
- [ ] Test structured data with RTL content
- [ ] Validate in Google Rich Results Test

#### 4.3 Local Language Keywords

- [ ] Add Dari/Pashto keyword research capability
- [ ] Store alternative language titles for products
- [ ] Generate multilingual meta descriptions

### Phase 5: Performance Optimization (Week 9-10)

#### 5.1 Core Web Vitals

- [ ] Install `web-vitals` for monitoring
- [ ] Optimize LCP (preload hero images, optimize fonts)
- [ ] Optimize INP (reduce JavaScript, defer non-critical)
- [ ] Optimize CLS (set image dimensions, reserve space)

#### 5.2 Image Optimization

- [ ] Ensure WebP/AVIF delivery
- [ ] Implement responsive images (srcset)
- [ ] Add blur placeholders
- [ ] Lazy load below-fold images

#### 5.3 Bundle Optimization

- [ ] Analyze bundles with `@next/bundle-analyzer`
- [ ] Code split per-store components
- [ ] Defer non-critical scripts

### Phase 6: SEO Dashboard for Store Owners (Week 11-12)

#### 6.1 SEO Health Score

- [ ] Check meta title length
- [ ] Check meta description length
- [ ] Verify images have alt text
- [ ] Check for missing canonical
- [ ] Verify structured data

#### 6.2 SEO Editor

- [ ] Allow store owners to edit meta title/description
- [ ] Preview OG/Twitter cards
- [ ] Preview Google SERP appearance

#### 6.3 Indexing Status

- [ ] Show Google indexing status
- [ ] Request re-indexing button
- [ ] Display crawl errors

---

## 7. Technical Specifications

### 7.1 robots.ts Implementation

```typescript
// app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/store/", "/api/og/"],
        disallow: [
          "/dashboard/",
          "/admin/",
          "/api/",
          "/_next/",
          "/checkout/",
          "/*?*", // Prevent parameter crawling
        ],
      },
      {
        userAgent: "Googlebot",
        allow: ["/store/", "/api/sitemap/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
```

### 7.2 Sitemap Index Implementation

```typescript
// app/sitemap.ts
import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";

  // Get all active stores
  const activeStores = await db.query.tenants.findMany({
    where: eq(tenants.status, "active"),
    columns: { slug: true, updatedAt: true },
  });

  // Platform pages
  const platformPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.3,
    },
  ];

  // Store sitemaps (each store will have its own detailed sitemap)
  const storePages = activeStores.map((store) => ({
    url: `${baseUrl}/store/${store.slug}`,
    lastModified: store.updatedAt,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [...platformPages, ...storePages];
}
```

### 7.3 Per-Store Sitemap

```typescript
// app/store/[slug]/sitemap.ts
import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { tenants, products, categories } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function generateSitemaps() {
  const stores = await db.query.tenants.findMany({
    where: eq(tenants.status, "active"),
    columns: { slug: true },
  });

  return stores.map((store) => ({ slug: store.slug }));
}

export default async function sitemap({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<MetadataRoute.Sitemap> {
  const { slug } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";

  // Get store
  const store = await db.query.tenants.findFirst({
    where: and(eq(tenants.slug, slug), eq(tenants.status, "active")),
  });

  if (!store) return [];

  // Get products
  const storeProducts = await db.query.products.findMany({
    where: and(
      eq(products.tenantId, store.id),
      eq(products.status, "active"),
      eq(products.showOnStorefront, true)
    ),
    columns: { slug: true, updatedAt: true },
  });

  // Get categories
  const storeCategories = await db.query.categories.findMany({
    where: eq(categories.tenantId, store.id),
    columns: { slug: true, updatedAt: true },
  });

  const storeUrl = `${baseUrl}/store/${slug}`;

  return [
    // Store homepage
    {
      url: storeUrl,
      lastModified: store.updatedAt,
      changeFrequency: "daily",
      priority: 1,
    },
    // Categories
    ...storeCategories.map((cat) => ({
      url: `${storeUrl}/category/${cat.slug}`,
      lastModified: cat.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    // Products
    ...storeProducts.map((product) => ({
      url: `${storeUrl}/product/${encodeURIComponent(product.slug)}`,
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
  ];
}
```

### 7.4 Store Structured Data Component

```typescript
// components/store/store-structured-data.tsx
import type { Organization, LocalBusiness, WithContext } from 'schema-dts';

interface StoreStructuredDataProps {
  store: {
    name: string;
    slug: string;
    description?: string | null;
    logoUrl?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    address?: {
      street?: string;
      city?: string;
      country?: string;
      postalCode?: string;
      lat?: number;
      lng?: number;
    } | null;
    socialLinks?: {
      facebook?: string;
      instagram?: string;
      twitter?: string;
    } | null;
  };
}

export function StoreStructuredData({ store }: StoreStructuredDataProps) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kakamalem.com';
  const storeUrl = `${baseUrl}/store/${store.slug}`;

  const sameAs = [
    store.socialLinks?.facebook,
    store.socialLinks?.instagram,
    store.socialLinks?.twitter,
  ].filter(Boolean) as string[];

  // Use LocalBusiness if address exists, otherwise Organization
  const hasAddress = store.address?.city || store.address?.street;

  const structuredData: WithContext<Organization | LocalBusiness> = hasAddress
    ? {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: store.name,
        url: storeUrl,
        ...(store.description && { description: store.description }),
        ...(store.logoUrl && { logo: `${baseUrl}${store.logoUrl}` }),
        ...(store.contactPhone && {
          telephone: store.contactPhone,
          contactPoint: {
            '@type': 'ContactPoint',
            telephone: store.contactPhone,
            contactType: 'customer service',
          },
        }),
        ...(sameAs.length > 0 && { sameAs }),
        address: {
          '@type': 'PostalAddress',
          ...(store.address?.street && { streetAddress: store.address.street }),
          ...(store.address?.city && { addressLocality: store.address.city }),
          addressCountry: store.address?.country || 'AF',
          ...(store.address?.postalCode && { postalCode: store.address.postalCode }),
        },
        ...(store.address?.lat && store.address?.lng && {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: store.address.lat,
            longitude: store.address.lng,
          },
        }),
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: store.name,
        url: storeUrl,
        ...(store.description && { description: store.description }),
        ...(store.logoUrl && { logo: `${baseUrl}${store.logoUrl}` }),
        ...(store.contactPhone && {
          contactPoint: {
            '@type': 'ContactPoint',
            telephone: store.contactPhone,
            contactType: 'customer service',
          },
        }),
        ...(sameAs.length > 0 && { sameAs }),
      };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
```

### 7.5 Breadcrumb Structured Data

```typescript
// components/store/breadcrumb-structured-data.tsx
import type { BreadcrumbList, WithContext } from 'schema-dts';

interface Breadcrumb {
  label: string;
  href: string;
  current?: boolean;
}

interface BreadcrumbStructuredDataProps {
  breadcrumbs: Breadcrumb[];
  storeSlug: string;
}

export function BreadcrumbStructuredData({
  breadcrumbs,
  storeSlug
}: BreadcrumbStructuredDataProps) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kakamalem.com';

  const structuredData: WithContext<BreadcrumbList> = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.label,
      ...(crumb.current
        ? {}
        : { item: crumb.href.startsWith('http') ? crumb.href : `${baseUrl}${crumb.href}` }),
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
```

### 7.6 Google Indexing API Integration

```typescript
// lib/seo/indexing.ts
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/indexing"];

interface IndexingCredentials {
  client_email: string;
  private_key: string;
}

export async function requestIndexing(
  url: string,
  type: "URL_UPDATED" | "URL_DELETED" = "URL_UPDATED"
) {
  const credentials: IndexingCredentials = {
    client_email: process.env.GOOGLE_INDEXING_CLIENT_EMAIL!,
    private_key: process.env.GOOGLE_INDEXING_PRIVATE_KEY!.replace(/\\n/g, "\n"),
  };

  const auth = new google.auth.JWT(
    credentials.client_email,
    undefined,
    credentials.private_key,
    SCOPES
  );

  const indexing = google.indexing({ version: "v3", auth });

  try {
    const response = await indexing.urlNotifications.publish({
      requestBody: { url, type },
    });

    return { success: true, data: response.data };
  } catch (error) {
    console.error("Indexing API error:", error);
    return { success: false, error };
  }
}

// Queue for batch indexing (respect 200/day limit)
export async function queueForIndexing(urls: string[]) {
  // Store in database queue, process via cron job
  // Implementation depends on your queue system
}
```

### 7.7 SEO Metadata Helper

```typescript
// lib/seo/metadata.ts
import type { Metadata } from "next";

interface GenerateMetadataOptions {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: "website" | "article" | "product";
  siteName?: string;
  noindex?: boolean;
  product?: {
    price: string;
    currency: string;
    availability: "InStock" | "OutOfStock" | "PreOrder";
  };
}

export function generateSEOMetadata(
  options: GenerateMetadataOptions
): Metadata {
  const {
    title,
    description,
    url,
    image,
    type = "website",
    siteName = "Kaka Malem",
    noindex = false,
    product,
  } = options;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";
  const absoluteUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;
  const absoluteImage = image?.startsWith("http")
    ? image
    : image
      ? `${baseUrl}${image}`
      : undefined;

  // Truncate to recommended lengths
  const truncatedTitle = title.length > 60 ? `${title.slice(0, 57)}...` : title;
  const truncatedDesc =
    description.length > 160 ? `${description.slice(0, 157)}...` : description;

  return {
    title: truncatedTitle,
    description: truncatedDesc,
    ...(noindex && { robots: { index: false, follow: false } }),
    alternates: {
      canonical: absoluteUrl,
    },
    openGraph: {
      type,
      title: truncatedTitle,
      description: truncatedDesc,
      url: absoluteUrl,
      siteName,
      ...(absoluteImage && {
        images: [{ url: absoluteImage, width: 1200, height: 630, alt: title }],
      }),
    },
    twitter: {
      card: absoluteImage ? "summary_large_image" : "summary",
      title: truncatedTitle,
      description: truncatedDesc,
      ...(absoluteImage && { images: [absoluteImage] }),
    },
    ...(product && {
      other: {
        "product:price:amount": product.price,
        "product:price:currency": product.currency,
        "product:availability": product.availability,
      },
    }),
  };
}
```

---

## 8. Monitoring & Analytics

### 8.1 Google Search Console Setup

1. **Verify Domain**
   - Add TXT record to DNS: `google-site-verification=XXXXXXXXX`
   - Or upload HTML file to `public/google-verification.html`

2. **Submit Sitemap**

   ```
   Sitemaps → Add new sitemap → https://kakamalem.com/sitemap.xml
   ```

3. **Monitor Performance**
   - Impressions, clicks, CTR, position
   - Filter by store: `store/store-slug/*`

4. **Index Coverage**
   - Check for crawl errors
   - Review excluded pages
   - Submit individual URLs for indexing

### 8.2 Core Web Vitals Monitoring

```typescript
// app/layout.tsx (or a client component)
"use client";

import { useEffect } from "react";
import { onCLS, onINP, onLCP } from "web-vitals";

function sendToAnalytics(metric: { name: string; value: number; id: string }) {
  // Send to your analytics endpoint
  fetch("/api/analytics/vitals", {
    method: "POST",
    body: JSON.stringify(metric),
  });
}

export function WebVitalsReporter() {
  useEffect(() => {
    onCLS(sendToAnalytics);
    onINP(sendToAnalytics);
    onLCP(sendToAnalytics);
  }, []);

  return null;
}
```

### 8.3 SEO Health Dashboard Schema

```typescript
interface SEOHealthCheck {
  storeId: string;
  checkedAt: Date;
  score: number; // 0-100
  checks: {
    hasMetaTitle: boolean;
    metaTitleLength: number; // Should be 50-60
    hasMetaDescription: boolean;
    metaDescriptionLength: number; // Should be 150-160
    hasCanonical: boolean;
    hasStructuredData: boolean;
    hasOgImage: boolean;
    allImagesHaveAlt: boolean;
    productCount: number;
    indexedProductCount: number;
    averagePageSpeed: number;
    coreWebVitals: {
      lcp: number;
      inp: number;
      cls: number;
    };
  };
  recommendations: string[];
}
```

### 8.4 Automated SEO Alerts

Set up alerts for:

- Crawl errors spike
- Indexing drops >10%
- Core Web Vitals degradation
- Structured data errors
- 404 increases

### 8.5 SEO Reporting Queries

```sql
-- Products missing SEO metadata
SELECT p.id, p.name, p.slug
FROM products p
WHERE p.tenant_id = $1
  AND (p.meta_title IS NULL OR p.meta_description IS NULL)
  AND p.status = 'active';

-- Products with short descriptions (bad for SEO)
SELECT p.id, p.name, LENGTH(p.description) as desc_length
FROM products p
WHERE p.tenant_id = $1
  AND LENGTH(p.description) < 100
  AND p.status = 'active';

-- Images without alt text
SELECT m.id, m.url, m.alt_text
FROM media m
WHERE m.tenant_id = $1
  AND (m.alt_text IS NULL OR m.alt_text = '');
```

---

## Appendix A: SEO Checklist for Store Owners

### Before Launch

- [ ] Set store name and tagline
- [ ] Upload high-quality logo (min 512x512)
- [ ] Write store description (150+ characters)
- [ ] Add contact information
- [ ] Configure social media links

### For Each Product

- [ ] Write unique title (50-60 characters)
- [ ] Write detailed description (300+ characters)
- [ ] Add 3+ high-quality images
- [ ] Set image alt text
- [ ] Add product to category
- [ ] Set correct price and availability

### Ongoing

- [ ] Update product information regularly
- [ ] Respond to reviews
- [ ] Add new products consistently
- [ ] Monitor Search Console for errors

---

## Appendix B: Resources

### Official Documentation

- [Google Search Central](https://developers.google.com/search)
- [Schema.org](https://schema.org)
- [Next.js Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Google Indexing API](https://developers.google.com/search/apis/indexing-api/v3/quickstart)

### Tools

- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Schema Markup Validator](https://validator.schema.org)
- [PageSpeed Insights](https://pagespeed.web.dev)
- [Google Search Console](https://search.google.com/search-console)

### NPM Packages

- [next-sitemap](https://github.com/iamvishnusankar/next-sitemap)
- [next-seo](https://github.com/garmeeh/next-seo)
- [schema-dts](https://github.com/google/schema-dts)

---

## Revision History

| Version | Date       | Author | Changes                        |
| ------- | ---------- | ------ | ------------------------------ |
| 1.0     | 2026-01-28 | Claude | Initial enterprise SEO roadmap |

---

## Next Steps

1. **Completed** ✅:
   - [x] Created `app/robots.ts`
   - [x] Created `app/sitemap.ts`
   - [x] Meta tags and canonical URLs via `generateMetadata`

2. **Short Term** (Next Sprint):
   - [ ] Verify domain in Google Search Console
   - [ ] Submit sitemap
   - [ ] Install `schema-dts` for type-safe structured data
   - [ ] Add Organization schema to store layout
   - [ ] Add BreadcrumbList schema to product/category pages
   - [ ] Enhance existing Product schema

3. **Medium Term** (Next Month):
   - [ ] Implement Google Indexing API
   - [ ] Build SEO dashboard for store owners
   - [ ] Add Core Web Vitals monitoring
   - [ ] Implement hreflang for Dari/Pashto

4. **Long Term** (Quarter):
   - [ ] AI-powered meta description generation
   - [ ] Automated SEO audits
   - [ ] Local SEO features for physical stores
   - [ ] Video SEO support
