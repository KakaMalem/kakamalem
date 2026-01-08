# Kaka Malem - Development Roadmap

## Phase 1: Foundation (Completed)

- [x] Project structure setup (`app/`, `lib/`, `components/`)
- [x] Drizzle ORM with Supabase connection
- [x] Local Supabase setup for development
  - [x] Combined Drizzle migrations into single schema file (`supabase/migrations/000_initial_schema.sql`)
  - [x] RLS policies migration (`supabase/migrations/001_rls_policies.sql`)
  - [x] Local environment configuration (`.env.local` for local dev)
  - [x] Successfully started local Supabase with Studio at http://127.0.0.1:54323
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

- [x] Products list with search/filter
- [x] Products list with drag-to-reorder (mouse + touch support)
- [x] Create/edit product form
  - [x] Basic info (name, slug, description, price)
  - [x] Category assignment
  - [x] Image upload with drag-to-reorder (mouse + touch support)
  - [x] Media selector for reusing existing images
  - [x] Inventory settings (track stock, allow backorder, low stock threshold)
  - [x] Weight for shipping
- [x] Product variants
  - [x] Variant options management (Size, Color, etc.)
  - [x] Create variants with SKU, price override, stock
  - [x] Variant images
- [x] Bulk actions (activate, deactivate, delete)

### Category Management

- [x] Categories list with drag-to-reorder (mouse + touch support)
- [x] Create/edit category (name, slug, description, image)
- [x] Media selector for category images

### Media Library

- [x] Grid view of all uploaded media with pagination
- [x] Upload new media (single and multiple)
- [x] Delete unused media (with in-use protection)
- [x] Alt text editing
- [x] Copy URL to clipboard
- [x] Search media by filename
- [x] Reusable media selector component (dialog-based)

### Inventory Management

#### Stock Overview Dashboard (`/dashboard/[slug]/inventory`)

- [x] Summary cards (total products, in stock, low stock, out of stock)
- [x] Quick stock status breakdown by category
- [x] Products at or below low stock threshold list
- [x] Stock value calculation (sum of stock × price)

#### Low Stock Alerts

- [x] Low stock indicator badges on products list
- [ ] Dashboard notification for low stock items
- [x] Filter products by stock status (in stock, low stock, out of stock)

#### Stock Adjustments (`/dashboard/[slug]/inventory/adjust`)

- [x] Manual stock adjustment form (add/remove stock)
- [ ] Bulk stock adjustment (CSV import)
- [x] Adjustment reason/notes field
- [x] Creates `inventory_movements` record with type: `adjustment`

#### Inventory Movement History (`/dashboard/[slug]/inventory/history`)

- [x] Paginated list of all stock changes
- [x] Filter by movement type (adjustment, sale, return, restock)
- [x] Filter by product/variant
- [ ] Filter by date range
- [x] Shows: product, variant, type, quantity (+/-), previous → new stock, reason, user, date

#### Product-Level Inventory

- [ ] Stock history tab on product edit page
- [x] Quick adjust stock button on product card
- [ ] Variant-level stock management (for products with variants)

---

## Phase 2.5: Inline Variant Generation System (COMPLETE)

### Overview

Enhance product creation/editing with inline variant generation:

- Single-page form with progressive disclosure
- Auto-generate variant combinations (Cartesian product) client-side
- Bulk editing (apply price/stock to all)
- Save everything in one server request

### Architecture

**Hybrid Global + Inline Options Approach:**

- Keep existing global `variantOptions` table for tenant-wide consistency
- Allow inline creation of new options during product creation
- Auto-suggest existing options as user types
- Generate variant matrix client-side (instant, no server wait)

### Step 0: Schema & Query Analysis

**Schema Status: No changes needed.** The existing schema fully supports inline variant generation:

- `variantOptions` - Tenant-scoped option types (Size, Color)
- `variantOptionValues` - Values per option (S, M, L)
- `productVariants` - SKUs with price, stock, displayName
- `productVariantOptions` - Junction linking variants to option values
- `products.hasVariants` - Boolean flag already exists

**New Query Required:**

- [x] Add `getProductVariantOptionTypes(tenantId, productId)` - `lib/db/queries/variants.ts`
  - Returns unique options used by a product with their values
  - Used to reconstruct the options array when editing existing products
  - Query: variants → variant_options junction → option_values → options

### Step 1: Core Utilities & Types

- [x] Create Cartesian product generator - `lib/variants/cartesian.ts`
  - `generateCartesianProduct(arrays)` - Generate all combinations
  - `generateDisplayName(values)` - Create "Red / S" style names
  - `generateSku(productSlug, values)` - Auto-generate SKU suggestions
  - `generateVariantCombinations(options)` - Main function for UI
  - `calculateVariantCount(options)` - Preview count
  - `validateVariantCount(count)` - Warning/error for too many variants
  - `groupVariantsByFirstOption(variants)` - For collapsible sections
- [x] Create variant form types - `lib/validations/variant-form.ts`
  - `InlineOption` type (id, name, values, isNew)
  - `InlineOptionValue` type (id, value, isNew)
  - `GeneratedVariant` type (tempId, optionValues, displayName, sku, price, stock, isActive)
- [x] Create Zod schemas for inline variant builder
  - `inlineOptionSchema` - Validate option name + values
  - `generatedVariantSchema` - Validate variant data
  - `productWithVariantsFormSchema` - Combined product + variants validation
  - `bulkPriceUpdateSchema`, `bulkStockUpdateSchema`, `bulkActiveToggleSchema` - Bulk operations

### Step 2: Variant Options Builder UI

- [x] Create `VariantOptionsBuilder` component - `components/dashboard/products/variant-options-builder.tsx`
  - "Add Option" button to add new option row
  - Option name input with autocomplete (suggests existing global options)
  - Tag-style value input (type value, press Enter to add)
  - Remove option button (X)
  - Real-time variant count preview ("This will create 12 variants")
- [x] Implement option name autocomplete
  - Fetch existing tenant options on mount
  - Filter as user types
  - Allow creating new option inline
- [x] Implement tag-style value input
  - Pill/badge style for added values
  - Click to remove value
  - Keyboard: Enter to add, Backspace to remove last, comma/Tab to add

### Step 3: Variant Matrix Table UI

- [x] Create `VariantMatrixTable` component - `components/dashboard/products/variant-matrix-table.tsx`
  - Auto-generated rows from Cartesian product
  - Columns: Variant (display name), SKU, Price, Stock, Active
  - Inline cell editing (click to edit)
- [x] Implement bulk actions toolbar
  - "Set all prices to: [___] [Apply]"
  - "Set all stock to: [___] [Apply]"
  - "Activate all" / "Deactivate all" buttons
- [x] Implement row grouping by first option (collapsible sections)
- [x] Add row-level exclude (exclude variant from generation via dropdown)
- [x] Add "Copy price from above" convenience action

### Step 4: ProductForm Integration

- [x] Add "This product has variants" toggle (Switch component)
- [x] Keep existing useState pattern (simpler than react-hook-form migration)
  - Added hasVariants, variantOptions, variants, variantError state
  - Used useCallback for handlers
- [x] Implement progressive disclosure sections:
  - Section 1: Basic Info (name, slug, description, category, base price)
  - Section 2: Images (product images with drag-to-reorder)
  - Section 3: Variant Options (VariantOptionsBuilder) - shown when hasVariants=true
  - Section 4: Variant Matrix (VariantMatrixTable) - shown when hasVariants=true
  - Section 5: Inventory (hidden when hasVariants=true, stock is per-variant)
  - Section 6: Shipping (weight - applies to all)
- [x] Single "Save Product" button at bottom
- [x] Visual section cards with Separator dividers
- [x] Cartesian product generation wired up with smart variant matching
- [x] Variant validation before form submission

### Step 5: Server Actions for Bulk Operations

- [x] Create `createProductVariantsInBulk` server action - `lib/supabase/variants.ts`
  - Create/find options → create/find values → create variants
  - Handle new option creation within product save
  - Set product.hasVariants = true
- [x] Create `updateProductVariantsInBulk` server action
  - Diff existing vs new variants
  - Delete removed variants
  - Update existing variants (match by option value combination)
  - Create new variants
  - Handle added options/values
- [x] Wire up server actions to ProductForm handleSubmit
  - Product saved first, then variants saved with product ID
  - Error handling: if variants fail, product still saved with warning

### Step 6: Edit Mode Support

- [x] Load existing variants into form on product edit
  - Added `getProductVariantOptionTypes` query to fetch product's options
  - Created `transformDbOptionsToInlineOptions` utility function
  - Created `transformDbVariantsToGeneratedVariants` utility function
  - Updated product edit page to fetch and pass initial data to ProductForm
  - Updated new product page to fetch existing tenant options for autocomplete
- [x] Handle variant matrix regeneration
  - Smart matching already implemented in Step 4 via `handleVariantOptionsChange`
  - Preserves existing variant data (price, stock, SKU) when combinations still exist
  - Only generates new combinations when values added
- [x] Handle option/variant removal
  - Confirm dialog when toggling off "This product has variants"
  - Shows count of variants that will be deleted
  - Destructive action button styling

### Step 7: Validation & Edge Cases

- [x] Prevent duplicate option names (real-time validation with error message)
- [x] Prevent duplicate values within same option (silently ignores duplicates)
- [x] Validate SKU uniqueness across all variants (real-time detection with error styling)
- [x] Require at least one option with one value if hasVariants=true (in handleSubmit)
- [x] Validate prices are valid positive numbers (Zod schema)
- [x] Limit maximum variants (100) with warning at 50+ (validateVariantCount)
- [x] Confirm dialog when toggling off variants (AlertDialog with destructive action)

### Step 8: UX Polish

- [x] Auto-generate SKU from product slug + option values (generateSku utility)
- [x] "Copy from above" button for quick data entry in matrix (copyPriceFromAbove)
- [ ] Keyboard navigation in matrix table (Tab between cells)
- [x] Loading states during save with progress indicator (isPending + Loader2)
- [x] Error highlighting on invalid cells (border-destructive on error fields)
- [x] Success toast on save (toast.success)
- [x] Mobile-responsive matrix (horizontal scroll via table container)

### Files Created

- [x] `lib/variants/cartesian.ts` - Cartesian product utilities
- [x] `lib/validations/variant-form.ts` - Types, Zod schemas, and transformation utilities
- [x] `components/dashboard/products/variant-options-builder.tsx` - Option builder UI with autocomplete
- [x] `components/dashboard/products/variant-matrix-table.tsx` - Matrix table with bulk actions

### Files Modified

- [x] `components/dashboard/products/product-form.tsx` - Added variant state, handlers, and UI integration
- [x] `lib/supabase/variants.ts` - Added bulk creation/update server actions
- [x] `lib/db/queries/variants.ts` - Added `getProductVariantOptionTypes` query
- [x] `app/dashboard/[slug]/products/[productId]/page.tsx` - Fetch and pass variant data
- [x] `app/dashboard/[slug]/products/new/page.tsx` - Fetch tenant options for autocomplete

### Deprecation Note

- `components/dashboard/products/product-variants-section.tsx` - Can be removed (replaced by inline system)

---

## Phase 3: Storefront (Customer-Facing)

### Store Layout

- [x] Store layout with header (logo, nav, cart) - `app/store/[slug]/layout.tsx`
  - [x] NavigationMenu with dropdown for categories
  - [x] Mobile menu with Sheet component
  - [x] Cart badge with item count
  - [x] Tagline banner
- [x] Footer with store info and social links - `components/store/store-footer.tsx`
  - [x] Store info section with logo/description
  - [x] Quick links, categories, contact info columns
  - [x] Social icons with tooltips (Facebook, Instagram, Twitter, YouTube, TikTok, Telegram, WhatsApp)
- [x] Mobile-responsive design (all storefront components)
- [x] SEO metadata generation in layout

### Product Pages

- [x] Store home page - `app/store/[slug]/page.tsx`
  - [x] Hero section with store name/tagline
  - [x] Category grid (up to 6 featured)
  - [x] Featured products grid (8 latest)
- [x] Category listing page - `app/store/[slug]/categories/page.tsx`
- [x] Category page with products - `app/store/[slug]/category/[categorySlug]/page.tsx`
  - [x] Breadcrumb navigation
  - [x] Category header with image
- [x] All products page - `app/store/[slug]/products/page.tsx`
- [x] Product grid with sorting and pagination - `components/store/product-grid.tsx`
  - [x] Sort by: newest, oldest, price low/high, name A-Z/Z-A
  - [x] Pagination with page numbers
- [x] Product card - `components/store/product-card.tsx`
  - [x] Image with hover zoom effect
  - [x] "View Product" overlay on hover
  - [x] Out of stock badge
  - [x] Price with "From" prefix for variants
- [x] Category card - `components/store/category-card.tsx`
  - [x] Image with gradient overlay
  - [x] Product count
  - [x] "Browse →" on hover
- [x] Product detail page - `app/store/[slug]/product/[productSlug]/page.tsx`
  - [x] Image gallery with thumbnails and keyboard navigation
  - [x] Variant selector (grouped by option type)
  - [x] Quantity selector
  - [x] Add to cart button (placeholder - needs Zustand store)
  - [x] Stock status indicator (in stock/low stock/out of stock)
  - [x] Product description
  - [x] Reviews section (display only - needs backend)

### Cart

- [x] Zustand cart store (tenant-isolated)
- [x] Cart sidebar/drawer component
- [x] Cart page with full item management
- [x] Update quantities (with optimistic updates)
- [x] Remove items (with optimistic updates)
- [x] Cart persistence (session-based for guests, merged on login)
- [x] Server actions for cart operations
- [x] Cart item count in header (synced with Zustand)

---

## Phase 3.1: Cart System Performance Improvements

### Analysis of Current Implementation

**What you already have (correctly implemented):**

- ✅ Zustand store with `persist` middleware (localStorage)
- ✅ Optimistic updates (`addItemOptimistic`, `updateItemOptimistic`, `removeItemOptimistic`)
- ✅ Tenant isolation (cart cleared when switching stores)
- ✅ Server actions for DB sync
- ✅ CartProvider that initializes from server data

**What the Gemini chat got RIGHT:**

1. **Local-First Architecture** - Your current implementation already follows this pattern with optimistic updates
2. **Zustand + localStorage persistence** - Already implemented correctly
3. **Guest-to-User cart merge** - You have `mergeGuestCartToCustomer` action
4. **Client-side totals** - Already calculating `itemCount` and `subtotal` in Zustand store

**What the Gemini chat got PARTIALLY RIGHT (needs context):**

1. **Debounced syncing** - This is useful for rapid +/- clicks, but your current "sync on every action" is also valid. Debouncing is an optimization, not a requirement.
2. **TanStack Query for mutations** - This adds rollback handling, but your current pattern with manual rollback also works. TanStack Query is cleaner but adds a dependency.
3. **idb-keyval for IndexedDB** - localStorage is fine for cart data (small payload). IndexedDB is overkill unless you're storing large objects like images.

**What the Gemini chat got WRONG or OVERSTATED:**

1. **"localStorage blocks main thread"** - For small JSON like a cart (~1-5KB), this is negligible. IndexedDB is async but adds complexity for minimal gain.
2. **"Next.js 16 updateTag()"** - This doesn't exist. They may be confused with `revalidateTag()` which you're already using via `revalidatePath()`.
3. **"React Compiler"** - While React 19/Next.js 15+ has better memoization, it doesn't eliminate the need for state management patterns.
4. **MMKV on web** - Correctly identified as mobile-only. The "web polyfill" is just localStorage with extra steps.

### Recommended Improvements (Priority Order)

#### High Priority (Noticeable UX Improvement)

- [x] **Add debounced syncing for quantity changes**

  - Rapid +/- clicks batch into single API call
  - Wait 400ms after last click before syncing
  - Prevents "request spam" on rapid clicking
  - Implementation: `lib/hooks/use-debounced-cart-sync.ts`

- [x] **Better rollback on sync failure**

  - On sync failure: Refetch entire cart from server
  - Prevents cart getting out of sync with DB
  - Added `getCartAction` for refetching

- [x] **Editable quantity input field**

  - Users can type quantities directly (e.g., 1000)
  - No more clicking +/- for large orders
  - Input validates on blur, supports Enter/Escape keys

- [x] **Loading states per item (not global)**
  - `isItemSyncing` per CartItem component
  - This is correct - keep individual item loading states

#### Medium Priority (Code Quality / Maintainability)

- [ ] **Consider TanStack Query for cart operations** (Optional)

  - Pros: Built-in optimistic updates, rollback, caching, deduplication
  - Cons: New dependency, learning curve, may be overkill
  - Decision: Skip unless you're already using TanStack Query elsewhere

- [ ] **Add cart validation on hydration**
  - When localStorage cart is loaded, validate items still exist/are in stock
  - Prevent showing stale cart items that are no longer available
  - Server action: `validateCartItemsAction(items[])`

#### Low Priority (Over-engineering for your scale)

- [ ] **IndexedDB storage (idb-keyval)** - Not needed for cart-sized data
- [ ] **Service Worker cart sync** - Overkill for current use case
- [ ] **Realtime subscription to cart changes** - Not needed unless multi-tab sync is critical

### Implementation Plan

#### Step 1: Debounced Syncing Hook

Create a hook that debounces cart sync operations:

```typescript
// lib/hooks/use-debounced-cart-sync.ts
function useDebouncedCartSync() {
  // Track pending changes
  // Debounce sync calls by 400ms
  // Batch multiple changes into single API call
  // Handle rollback on failure
}
```

#### Step 2: Update CartItem Component

Modify quantity change handlers to use debounced sync:

```typescript
// Instead of immediate server action call:
const result = await updateCartItemQuantityAction(...);

// Use debounced version:
debouncedUpdateQuantity(itemId, newQuantity);
```

#### Step 3: Cart Validation on Load

Add server-side validation when cart hydrates from localStorage:

```typescript
// In CartProvider, after loading from localStorage:
// 1. Check if products still exist
// 2. Check if stock is still available
// 3. Update cart with valid items only
// 4. Show toast for removed items
```

### Files Modified

- [x] `lib/hooks/use-debounced-cart-sync.ts` (new file) - Debounced sync hook with rollback
- [x] `components/store/cart-item.tsx` - Debounced sync + editable quantity input
- [x] `lib/cart/actions.ts` - Added `getCartAction` for refetching
- [ ] `components/store/cart-provider.tsx` - Add validation on hydration (future enhancement)

### Summary

Your current cart implementation is **already well-architected**. The Gemini suggestions contain some good ideas (debouncing) mixed with over-engineering (IndexedDB, TanStack Query for a simple cart).

**Recommended next step:** Implement debounced syncing for quantity changes. This is the highest-impact improvement with the least complexity.

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
- [x] Display reviews on product page (basic component created)
- [ ] Owner reply display

---

## Phase 3.5: Dual-Context Auth System

The platform needs to support two distinct user contexts sharing the same Supabase Auth:

### Architecture Overview

1. **Platform Users (Store Owners/Staff)**

   - Sign up at `/signup` to create and manage stores
   - Access `/dashboard` for store management
   - Stored in `profiles` table with roles (admin, owner, staff)
   - Can be members of multiple stores via `tenant_members`

2. **Store Customers (Shoppers)**
   - Sign up/login on individual store pages (`/store/[slug]/login`)
   - Browse, add to cart, checkout on that store
   - Stored in `customers` table (tenant-scoped)
   - Access order history, saved addresses, wishlists per store

### Database Schema

- [ ] Create `customers` table (tenant-scoped)
  - `id`, `tenant_id`, `user_id` (nullable for guest checkout)
  - `email`, `name`, `phone`
  - `default_shipping_address` (jsonb), `default_billing_address` (jsonb)
  - `marketing_consent`, `created_at`, `updated_at`
- [ ] Create `customer_addresses` table (multiple saved addresses per customer)
- [ ] Create `wishlists` and `wishlist_items` tables
- [ ] Add RLS policies for customer data isolation

### Storefront Customer Auth

- [ ] `/store/[slug]/login` - Customer login page
- [ ] `/store/[slug]/register` - Customer registration page
- [ ] `/store/[slug]/forgot-password` - Password reset for customers
- [ ] Store-specific auth redirects (customers stay on store after login)
- [ ] Cart merge on customer login (guest cart → customer cart)

### Customer Account Pages

- [ ] `/store/[slug]/account` - Customer account dashboard
- [ ] `/store/[slug]/account/orders` - Order history
- [ ] `/store/[slug]/account/orders/[orderId]` - Order detail with tracking
- [ ] `/store/[slug]/account/addresses` - Saved addresses management
- [ ] `/store/[slug]/account/wishlist` - Wishlist page
- [ ] `/store/[slug]/account/settings` - Profile settings (name, email, password)

### Checkout Enhancements

- [ ] Guest checkout flow (no account required)
- [ ] Optional account creation post-checkout
- [ ] Save address to account option
- [ ] Logged-in customer: pre-fill from saved addresses
- [ ] Order placed → customer record created if guest with email

### Store Header Updates

- [ ] Show customer name/avatar when logged in as customer
- [ ] Show "My Account" dropdown for logged-in customers
- [ ] Differentiate UI when store owner is viewing their own store
- [ ] "Owner View" indicator/badge for store owners browsing their store

### Auth Redirects & Context

- [ ] Platform auth (`/login`, `/signup`) → `/dashboard`
- [ ] Store auth (`/store/[slug]/login`) → back to store (or checkout if from cart)
- [ ] Detect context: is user a customer of this store? an owner? both?
- [ ] Session context helper functions

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
- [x] Customer accounts (order history, saved addresses) - Moved to Phase 3.5
- [x] Wishlist functionality - Moved to Phase 3.5
- [ ] Store themes/templates
- [ ] Custom domain support
- [ ] Admin panel for platform management
