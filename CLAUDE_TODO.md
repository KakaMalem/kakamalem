# Kaka Malem - Development Roadmap

## Phase 1: Foundation (Completed)

- [x] Project structure setup (`app/`, `lib/`, `components/`)
- [x] Drizzle ORM with Supabase connection
- [x] Database schema design
  - [x] Core: profiles, tenants, tenant_members, categories, products, media
  - [x] Inventory: variant_options, variant_option_values, product_variants, inventory_movements
  - [x] Orders: carts, cart_items, orders, order_items
  - [x] Shipping: shipping_zones, shipping_methods, shipments, shipment_items, tracking_events
  - [x] Reviews: reviews, review_media
  - [x] Billing: commission_transactions
  - [x] Analytics: daily_snapshots, hourly_metrics, product/category performance, traffic, geo, page_views, conversion_events
- [x] RLS policies for tenant isolation (`supabase/migrations/001_rls_policies.sql`)
- [x] Authentication system
  - [x] Email/password signup and login
  - [x] Google OAuth
  - [x] Facebook OAuth
  - [x] Auth callback handler
  - [x] Email confirmation flow
  - [x] Zod validation (client + server)
- [x] Landing page (basic)

---

## Phase 2: Dashboard (Store Owner)

### Layout & Navigation

- [x] Dashboard layout with sidebar navigation
- [x] Responsive mobile menu (sheet-based on mobile)
- [x] User dropdown (profile, settings, logout)
- [x] Breadcrumb navigation
- [x] Store switcher dropdown (multi-store support)
- [x] Settings sub-layout with navigation tabs
- [x] Two-column sidebar pattern (icon strip + expanded area)

### Store Setup

- [x] Create store flow (name, slug, currency) - Multi-step wizard at `/dashboard/new`
- [x] Store settings page
  - [x] Basic info (name, description, contact) - `/dashboard/[slug]/settings`
  - [x] Branding (logo, favicon, header display) - `/dashboard/[slug]/settings/branding`
  - [x] Social links (Facebook, Instagram, WhatsApp, etc.) - `/dashboard/[slug]/settings/social`
  - [x] SEO metadata (meta title, description, OG image) - `/dashboard/[slug]/settings/seo`
  - [x] Team members placeholder - `/dashboard/[slug]/settings/team`
  - [x] Danger zone placeholder - `/dashboard/[slug]/settings/danger`
- [x] Multi-store routing (`/dashboard/[slug]/` dynamic routes)
  - [x] Store-specific dashboard pages
  - [x] Store context validation in layout
  - [x] Sidebar navigation with store-aware URLs
  - [x] Store switcher navigation
  - [x] Redirects from old routes to store-specific routes
- [x] International phone input component with country selector

### Product Management

- [ ] Products list with search/filter
- [ ] Create/edit product form
  - [ ] Basic info (name, slug, description, price)
  - [ ] Category assignment
  - [ ] Image upload (Supabase Storage)
  - [ ] Inventory settings (track stock, allow backorder, low stock threshold)
  - [ ] Weight for shipping
- [ ] Product variants
  - [ ] Variant options management (Size, Color, etc.)
  - [ ] Create variants with SKU, price override, stock
  - [ ] Variant images
- [ ] Bulk actions (activate, deactivate, delete)

### Category Management

- [ ] Categories list with drag-to-reorder
- [ ] Create/edit category (name, slug, description, image)

### Media Library

- [ ] Grid view of all uploaded media
- [ ] Upload new media
- [ ] Delete unused media
- [ ] Alt text editing

### Inventory

- [ ] Stock overview dashboard
- [ ] Low stock alerts
- [ ] Manual stock adjustments
- [ ] Inventory movement history

---

## Phase 3: Storefront (Customer-Facing)

### Store Layout

- [ ] Store layout with header (logo, nav, cart)
- [ ] Footer with store info and social links
- [ ] Mobile-responsive design

### Product Pages

- [ ] Category listing page
- [ ] Product grid with filters
- [ ] Product detail page
  - [ ] Image gallery
  - [ ] Variant selector
  - [ ] Add to cart
  - [ ] Reviews display

### Cart

- [ ] Zustand cart store (tenant-isolated)
- [ ] Cart sidebar/page
- [ ] Update quantities
- [ ] Remove items
- [ ] Cart persistence (session-based for guests)

### Checkout

- [ ] Customer info form
- [ ] Shipping address
- [ ] Shipping method selection (based on zone)
- [ ] Order summary
- [ ] Place order (create order, reduce stock)
- [ ] Order confirmation page

### Reviews

- [ ] Submit review form (after purchase)
- [ ] Image upload with review
- [ ] Display reviews on product page
- [ ] Owner reply display

---

## Phase 4: Order Management

### Order Dashboard

- [ ] Orders list with status filters
- [ ] Order detail page
  - [ ] Customer info
  - [ ] Items ordered
  - [ ] Shipping info
  - [ ] Status timeline
- [ ] Update order status
- [ ] Staff notes

### Shipping & Fulfillment

- [ ] Shipping zones setup
- [ ] Shipping methods per zone
- [ ] Create shipment for order
- [ ] Add tracking info
- [ ] Tracking events log

### Commission Tracking

- [ ] Commission balance display
- [ ] Transaction history
- [ ] Free tier progress indicator
- [ ] Grace period warning

---

## Phase 5: Analytics

### Dashboard Widgets

- [ ] Revenue chart (daily/weekly/monthly)
- [ ] Orders count
- [ ] Top products
- [ ] Conversion rate

### Detailed Reports

- [ ] Product performance table
- [ ] Category performance
- [ ] Traffic sources breakdown
- [ ] Geographic sales map

### Real-time

- [ ] Hourly metrics display
- [ ] Live visitor count (if feasible)

---

## Phase 6: Polish & Production

### Performance

- [ ] Image optimization
- [ ] API route caching
- [ ] Database query optimization

### Security

- [ ] Rate limiting on API routes
- [ ] Input sanitization audit
- [ ] CSRF protection verification

### SEO

- [ ] Dynamic meta tags per store
- [ ] Sitemap generation
- [ ] robots.txt

### Testing

- [ ] Set up testing framework (Vitest or Jest)
- [ ] Unit tests for utilities
- [ ] Integration tests for server actions
- [ ] E2E tests for critical flows (Playwright)

### Deployment

- [ ] Vercel deployment configuration
- [ ] Environment variables setup
- [ ] Database migrations pipeline
- [ ] Monitoring (Sentry or similar)

---

## Future Enhancements (Post-MVP)

- [ ] Multi-language support (Dari, Pashto, English)
- [ ] Payment gateway integration (local Afghan options)
- [ ] Email notifications (order confirmation, shipping updates)
- [ ] SMS notifications (WhatsApp API)
- [ ] Discount codes / coupons
- [ ] Customer accounts (order history, saved addresses)
- [ ] Wishlist functionality
- [ ] Store themes/templates
- [ ] Custom domain support
- [ ] Admin panel for platform management
