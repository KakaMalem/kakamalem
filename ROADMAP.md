# Kaka Malem - Development Roadmap

## Phase 1: Foundation (Completed)

- [x] Project structure setup (`app/`, `lib/`, `components/`)
- [x] Drizzle ORM with PostgreSQL 18 + PgBouncer
- [x] Database migration system
  - [x] Drizzle migrations in `drizzle/` folder
  - [x] Custom SQL migrations in `drizzle/custom/` (triggers, functions)
  - [x] Migration tracking via `custom_migrations` table
- [x] Database schema design
  - [x] Core: profiles, tenants, tenant_members, categories, products, media
  - [x] Inventory: variant_options, variant_option_values, product_variants, inventory_movements
  - [x] Orders: carts, cart_items, orders, order_items
  - [x] Shipping: shipping_zones, shipping_methods, shipments, shipment_items, tracking_events
  - [x] Reviews: reviews, review_media
  - [x] Billing: commission_transactions
  - [x] Analytics: daily_snapshots, hourly_metrics, product/category performance, traffic, geo, page_views, conversion_events
- [x] Application-level tenant isolation (all queries filter by `tenant_id`)
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

- [x] Customer info form (guest checkout support)
- [x] Shipping address (select saved or enter new)
- [x] Shipping method selection (zone-based matching)
- [x] Order summary (sidebar with cart items and totals)
- [x] Place order (atomic transaction, stock reduction, inventory movements)
- [x] Order confirmation page (success page with order details)

**Checkout Implementation Details:**

- Single-page multi-step checkout (3 steps: Contact/Shipping, Delivery Method, Review)
- Guest checkout support (no account required)
- Zone-based shipping with priority matching (postal codes > cities > states > countries)
- 5 rate types: flat, per_item, weight_based, weight_tiered, price_based
- Atomic order creation with transaction rollback
- Store customer record created on first order (lazy creation)
- Zustand store for checkout state (sessionStorage persistence)

### Reviews

- [ ] Submit review form (after purchase)
- [ ] Image upload with review
- [x] Display reviews on product page (basic component created)
- [ ] Owner reply display

---

## Phase 3.5: Hybrid Auth System (Store-Aware Authentication)

A unified authentication system where one account works everywhere, with context-aware redirects based on WHERE the user logs in.

### Architecture Overview

**Core Principle:** Single Better Auth account, context-aware experience.

```
User Account (Better Auth)
    │
    ├── As Store Owner/Staff → /dashboard/[slug]
    │   └── Via tenant_members table
    │
    └── As Customer → /store/[slug]/*
        ├── Orders reference user.id directly
        ├── Addresses stored in user_addresses (platform-wide)
        └── Store-specific metadata in store_customers (optional)
```

**Route Architecture (Hybrid Approach):**

| Route                       | Purpose                            | Redirect After Auth          |
| --------------------------- | ---------------------------------- | ---------------------------- |
| `/(auth)/login`             | Store owners/staff login           | `/dashboard` or `?redirect=` |
| `/(auth)/signup`            | New users wanting to create stores | `/dashboard/new`             |
| `/store/[slug]/auth/login`  | Customers shopping at a store      | Back to store or checkout    |
| `/store/[slug]/auth/signup` | New customers (store-branded)      | Back to store                |

**Why This Works:**

- Same Better Auth backend for all routes
- OAuth callbacks use `state` parameter to know where user came from
- Session is shared across all routes (same domain)
- Store-branded pages give immersive experience without extra complexity

### Database Schema (Already Complete!)

The schema already supports this architecture:

- [x] `user` - Better Auth user table (centralized auth)
- [x] `user_profiles` - Extended profile (platform role, preferences)
- [x] `user_addresses` - Platform-wide saved addresses (work at ANY store)
- [x] `store_customers` - Tenant-scoped metadata (NOT for auth)
  - Created lazily on: first order, marketing opt-in, or staff tagging
  - Stores: marketing consent, internal notes, tags, order stats
- [x] `wishlists` / `wishlist_items` - Already exist, tenant-scoped
- [x] RLS policies for tenant isolation

**No new tables needed!** The existing schema is designed for this.

### Phase 3.5.1: Store Auth Routes

**Route Group Structure (for layout separation):**

```
app/store/[slug]/
├── (storefront)/     <- Full store layout (nav + footer)
│   ├── layout.tsx
│   ├── page.tsx
│   ├── account/
│   ├── cart/
│   └── product/
└── (auth)/           <- Minimal auth layout (no nav/footer)
    ├── layout.tsx
    └── auth/
        ├── login/
        ├── signup/
        └── forgot-password/
```

#### Store Login Page - `/store/[slug]/auth/login`

- [x] Create `app/store/[slug]/auth/login/page.tsx`
- [x] Store-branded login form component
  - [x] Show store logo and name
  - [x] Email/password login
  - [x] OAuth buttons (Google, Facebook)
  - [x] "Create account" link → store signup
  - [x] "Forgot password" link → store password reset
- [x] Handle `?redirect=` param (e.g., from checkout)
- [x] After login → redirect to store (or checkout if redirected from there)

#### Store Signup Page - `/store/[slug]/auth/signup`

- [x] Create `app/store/[slug]/auth/signup/page.tsx`
- [x] Store-branded signup form
  - [x] Name, email, password fields
  - [x] OAuth signup options
  - [x] "Already have an account?" → store login
- [x] After signup → redirect to store
- Note: Marketing consent removed - `store_customers` created lazily on first order

#### Store Password Reset - `/store/[slug]/auth/forgot-password`

- [x] Create `app/store/[slug]/auth/forgot-password/page.tsx`
- [x] Store-branded password reset form
- [x] Shares same Better Auth reset flow, just different UI

#### Store Auth Layout

- [x] Create `app/store/[slug]/(auth)/layout.tsx` (route group for minimal layout)
  - [x] Minimal centered auth card layout (no nav/footer)
  - [x] Store validation and redirect if already logged in
  - [ ] Store theme colors applied (future enhancement)

### Development Auth Configuration

- [x] Email verification disabled in development (`requireEmailVerification: process.env.NODE_ENV === "production"`)
- [x] Verification emails logged to console in dev mode
- [x] Auto sign-in after registration in development

### Phase 3.5.2: OAuth Callback Handling

Better Auth OAuth uses `callbackURL` parameter for redirects after provider auth.

- [x] OAuth buttons pass callbackURL for store-specific redirects
- [ ] Advanced: Encode return context in OAuth state parameter (optional enhancement)
- [x] Handle edge cases:
  - [x] User clicks OAuth on store → redirects to store (via callbackURL)
  - [x] User clicks OAuth on main site → redirects to dashboard
  - [x] Default behavior works via callbackURL param

### Phase 3.5.3: Auth Context Helpers

Server-side utilities for detecting user context.

- [x] Create `lib/auth/context.ts`:
  - [x] `getUserStoreContext(tenantId)` - Get user's relationship to a store
  - [x] `canManageStore(tenantId)` - Check if user can manage store
  - [x] `hasMinimumRole(tenantId, role)` - Check role hierarchy
  - [x] `getUserDefaultAddress()` - Get default shipping address
  - [x] `getUserAddresses()` - Get all saved addresses
  - [x] `buildStoreAuthRedirect()` - Build redirect URLs
  - [x] `parseRedirectParam()` - Safely parse redirect params

### Phase 3.5.4: Store Header Auth State

Update store header to show auth-aware UI.

- [x] Update `components/store/store-header.tsx`:
  - [x] Show "Login" / "Sign Up" buttons when logged out (store-specific links)
  - [x] Show user avatar dropdown when logged in:
    - [x] "My Account" → `/store/[slug]/account`
    - [x] "My Orders" → `/store/[slug]/account/orders`
    - [x] "Wishlist" → `/store/[slug]/account/wishlist`
    - [x] "Logout"
  - [x] Show "Owner Badge" if user owns this store (links to dashboard)
  - [x] Show "Staff Badge" if user is staff (links to dashboard)

### Phase 3.5.5: Customer Account Pages

Account pages for customers viewing their data at a specific store.

#### Account Dashboard - `/store/[slug]/account`

- [x] Create `app/store/[slug]/account/page.tsx`
- [x] Quick links: orders, addresses, wishlist, settings (with counts)
- [x] Recent orders summary (last 3 orders)
- [ ] Account completion prompt (add phone, etc.) - future enhancement

#### Account Layout

- [x] Create `app/store/[slug]/account/layout.tsx`
- [x] Sidebar navigation (orders, addresses, wishlist, settings)
- [x] Protected route (redirect to login if not authenticated)

#### Order History - `/store/[slug]/account/orders`

- [x] Create `app/store/[slug]/account/orders/page.tsx`
- [x] List orders placed at THIS store (filtered by tenant)
- [x] Order card: date, status, total, item count
- [x] Pagination

#### Order Detail - `/store/[slug]/account/orders/[orderId]`

- [x] Create `app/store/[slug]/account/orders/[orderId]/page.tsx`
- [x] Order summary (items, quantities, prices)
- [x] Shipping address
- [x] Order status with badge
- [x] Tracking info (if shipped)
- [x] "Need help?" link

#### Saved Addresses - `/store/[slug]/account/addresses`

- [x] Create `app/store/[slug]/account/addresses/page.tsx`
- [x] List addresses from `user_addresses` (platform-wide)
- [x] Add new address form (dialog-based)
- [x] Edit/delete existing addresses
- [x] Set default address
- [x] Info note: "Addresses are saved to your account and work at any store"

#### Wishlist - `/store/[slug]/account/wishlist`

- [x] Create `app/store/[slug]/account/wishlist/page.tsx`
- [x] List wishlisted products for THIS store (with images and prices)
- [x] Remove from wishlist
- [x] View product button (links to product page)
- [ ] "Notify when back in stock" (future enhancement)

#### Account Settings - `/store/[slug]/account/settings`

- [x] Create `app/store/[slug]/account/settings/page.tsx`
- [x] Update name
- [x] Change password
- [x] Delete account (with confirmation)
- [ ] Update email (with verification) - future enhancement
- [ ] Marketing preferences for THIS store - future enhancement

### Phase 3.5.6: Cart & Auth Integration

- [ ] Cart merge on login (guest cart → user cart)
  - Already have `mergeGuestCartToCustomer` action
  - Wire it up in login success flow
- [ ] "Login to save your cart" prompt for guests with items
- [ ] Cart persists across store visits (same user)

### Phase 3.5.7: Platform Auth Updates

Update main auth pages to redirect dashboard-bound users.

- [ ] Update `/(auth)/login`:
  - [ ] After login → `/dashboard` (or `?redirect=` param)
  - [ ] Add "Shopping? Login at the store instead" hint
- [ ] Update `/(auth)/signup`:
  - [ ] After signup → `/dashboard/new` (create first store)
  - [ ] Add "Want to shop? No account needed for checkout"

### Phase 3.5.8: Store Customer Record Management

Handle `store_customers` record lifecycle (lazy creation on first order).

- [ ] Create `store_customers` record on:
  - [ ] First order at store (automatic) - primary trigger
  - [ ] Store owner/staff manually adds customer
- [ ] Update order stats after order completion:
  - [ ] Increment `total_orders`
  - [ ] Add to `total_spent`
  - [ ] Update `last_order_at`
- [ ] Server action: `upsertStoreCustomer(tenantId, userId, data)`

### Implementation Priority

1. **High Priority (Auth Flow)**
   - Store login/signup pages
   - OAuth callback handling
   - Auth context helpers
   - Header auth state

2. **Medium Priority (Account)**
   - Account dashboard
   - Order history
   - Saved addresses

3. **Lower Priority (Enhanced Features)**
   - Wishlist page
   - Account settings
   - Store customer stats

### Performance Notes

- **No extra database calls** for basic auth - Better Auth handles it
- **Lazy loading** of store_customers record - only created when needed
- **Platform-wide addresses** means no duplication per store
- **Single session** works everywhere - no multi-auth complexity

---

## Phase 4: Order Management (Completed)

### Order Dashboard

- [x] Orders list with status filters
- [x] Order detail page
  - [x] Customer info
  - [x] Items ordered
  - [x] Shipping info
  - [x] Status timeline
- [x] Update order status
- [x] Staff notes

### Offline Sales (POS)

- [x] POS interface for in-store sales
- [x] Offline support via PWA (Dexie + Serwist)
- [x] Sync queue for offline orders
- [x] Variant selection in POS

### Shipping & Fulfillment

- [x] Shipping zones setup
- [x] Shipping methods per zone (5 rate types)
- [x] Zone priority matching (postal > city > state > country)
- [ ] Create shipment for order
- [ ] Add tracking info
- [ ] Tracking events log

### Commission Tracking

- [ ] Commission balance display
- [ ] Transaction history
- [ ] Free tier progress indicator
- [ ] Grace period warning

---

## Phase 5: Analytics (In Progress)

### Dashboard Widgets (Completed)

- [x] Revenue chart (daily/weekly/monthly) - `RevenueTrendChart`
- [x] Orders count chart - `OrdersTrendChart`
- [x] Top products list - `AnalyticsTopProducts`
- [x] KPI cards (Revenue, Orders, AOV, Customers) - `EnhancedAnalyticsKPICards`
- [x] Customer split (new vs returning) - `CustomerSplitCard`
- [x] Time range filtering (today, 7d, 30d, 90d, custom) - `AnalyticsFilterBar`
- [x] Export dropdown (CSV) - `ExportDropdown`

### Detailed Reports (Completed)

- [x] Product performance table - `ProductPerformanceTable` + `/api/analytics/products`
- [x] Category performance (pie/donut chart) - `CategoryDistributionChart` + `/api/analytics/categories`
- [x] Sales heatmap (hour × day-of-week) - `SalesHeatmap` + `/api/analytics/heatmap`
- [x] Geographic sales data - `getGeographicSales()` + `/api/analytics/geographic`
- [ ] Traffic sources breakdown (requires UTM tracking implementation)
- [ ] Conversion funnel (requires event tracking for full funnel)

### Real-time (Completed)

- [x] Real-time metrics indicator (30s polling) - `RealTimeIndicator` + `/api/analytics/realtime`
- [x] Today's orders and revenue
- [ ] Live visitor count (requires session tracking)

### Event Tracking (Not Started)

- [ ] Page view tracking (`analytics_page_views` table exists)
- [ ] Conversion events (add_to_cart, checkout_start, purchase)
- [ ] Full conversion funnel with dropoff rates
- [ ] UTM parameter capture for traffic sources

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

### SEO (Completed)

- [x] Dynamic meta tags per store (`generateMetadata`)
- [x] Sitemap generation (`app/sitemap.ts`)
- [x] robots.txt (`app/robots.ts`)
- [x] Structured data (JSON-LD for products)

### Testing

- [ ] Set up testing framework (Vitest or Jest)
- [ ] Unit tests for utilities
- [ ] Integration tests for server actions
- [ ] E2E tests for critical flows (Playwright)

### Deployment (Completed)

- [x] Docker deployment with blue-green strategy
- [x] Environment variables setup
- [x] Database migrations pipeline (Drizzle)
- [x] Health check endpoint (`/api/health`)
- [ ] Monitoring (Sentry or similar)

---

## Phase 7: Advanced Variant Management System

### Research Summary (January 2026)

#### Industry Standards from Major Platforms

| Platform    | Variant Limit | Key Features                                           |
| ----------- | ------------- | ------------------------------------------------------ |
| Shopify     | 2,048 (2025)  | AJAX-based loading, GraphQL API, 3 options per product |
| BigCommerce | 600           | Shared variants/modifiers, V3 options system           |
| Amazon      | 2,000 ASINs   | Parent-child structure, Variation Wizard, flat files   |
| WooCommerce | Unlimited     | Attribute-based, bulk variations plugin ecosystem      |
| Magento     | Unlimited     | Configurable products, matrix/grid extensions          |

**Key Takeaways:**

- Major platforms are increasing limits (Shopify: 100 → 2,048)
- Parent-child hierarchy is the dominant pattern
- Shared/global options reduce duplication
- Matrix/grid views are essential for B2B/wholesale

#### UX Best Practices (Baymard Institute & Industry Research)

**Visual Swatches:**

- Minimum touch target: 7mm × 7mm (critical for mobile)
- Minimum spacing between swatches: 2mm
- 57% of e-commerce sites fail to show all swatches in product lists
- Interactive swatches on listings increase engagement
- Instant image updates on swatch selection

**Swatch Types:**

- Color swatches: circles/squares with actual color fill
- Image swatches: thumbnails for patterns, textures, materials
- Text swatches: pills/badges for sizes with out-of-stock strikethrough
- Dual-color swatches: for two-tone options

**Matrix/Grid Patterns (B2B/Wholesale):**

- Display all variants in table format
- Quantity input per cell for bulk ordering
- Show stock status, tier pricing per cell
- Collapsible sections by first option (e.g., group by Color)

#### Emerging Trends 2025-2026

1. **AI-Powered Variant Generation**
   - PIM systems (Pimberly, Akeneo, Pimcore) auto-generate variant combinations
   - AI suggests option values based on product type
   - Automated SKU generation with smart naming
   - Bulk content variation for marketing copy

2. **Dynamic/Generative UI**
   - Interface adapts based on variant count and type
   - Progressive disclosure: simple selector for <5 variants, matrix for 50+
   - AI-driven swatch recommendations based on product images

3. **Cross-Platform Synchronization**
   - Single variant source → multiple channels (website, Amazon, social)
   - Real-time inventory sync across platforms
   - Unified SKU management

4. **Accessibility First**
   - ARIA attributes as default
   - Keyboard navigation (Tab between swatches, Enter to select)
   - Screen reader announcements for selections
   - High contrast mode for swatches

5. **Hyper-Personalization**
   - Show "most popular" variant pre-selected
   - Customer segment-specific default selections
   - "Recommended for you" variant highlighting

---

### Current Implementation Analysis

**What We Have:**

- [variant-options-manager.tsx](components/dashboard/variants/variant-options-manager.tsx) - Card-based option manager
- Badge/pill style for option values
- Inline editing (click to edit)
- Add/remove values inline
- No visual swatches (text only)
- No drag-to-reorder for options/values
- Separate from product form (global options page)

**What's Missing:**

- Visual swatch support (color, image)
- Drag-to-reorder for display order
- Bulk value management (import from CSV/text)
- Option templates (pre-defined sets like "T-Shirt Sizes")
- Search/filter when many options exist
- Matrix view for variant bulk editing
- Variant image assignment per option value
- Stock preview per variant in options manager

---

### Phase 7.1: Visual Swatch System

#### Schema Updates

- [ ] Add `swatch_type` to `variant_option_values` table
  - Enum: `text`, `color`, `image`
- [ ] Add `swatch_value` to `variant_option_values` table
  - For `color`: hex code (e.g., `#FF5733`)
  - For `image`: media_id reference
  - For `text`: null (uses value field)
- [ ] Migration for existing data (default to `text` type)

#### Option Value Swatch Editor

- [ ] Create `SwatchEditor` component
  - Type selector: Text / Color / Image
  - Color picker (for color type) with hex input
  - Media selector (for image type)
  - Preview of how swatch will appear
- [ ] Update `variant-options-manager.tsx` to use SwatchEditor
- [ ] Swatch preview in option value badges

#### Storefront Swatch Display

- [ ] Create `VariantSwatchSelector` component for PDP
  - Render color circles, image thumbnails, or text pills based on type
  - Selected state styling (border/ring)
  - Out-of-stock styling (strikethrough, opacity)
  - Disabled state for unavailable combinations
- [ ] Interactive swatches on product cards (optional per store setting)
- [ ] Mobile-optimized swatch layout (horizontal scroll vs wrap)

---

### Phase 7.2: Enhanced Options Manager UX

#### Drag-to-Reorder

- [ ] Drag-to-reorder option cards (dnd-kit)
- [ ] Drag-to-reorder values within options
- [ ] Visual drag handles
- [ ] Auto-save display order changes

#### Bulk Value Management

- [ ] "Add Multiple Values" button
  - Text area input (comma or newline separated)
  - Paste from spreadsheet support
- [ ] "Import from Template" dropdown
  - Pre-defined sets: "Standard Sizes (XS-XXL)", "US Shoe Sizes", "Ring Sizes"
  - Store-specific saved templates
- [ ] "Copy Values" - copy values from another option
- [ ] Bulk delete selected values

#### Option Templates

- [ ] Create `OptionTemplate` entity (optional)
  - Or: built-in presets in code
- [ ] Template categories: Clothing, Footwear, Jewelry, Electronics
- [ ] "Save as Template" for custom reusable options
- [ ] Template marketplace (future: community templates)

#### Search & Filter

- [ ] Search bar for options (when 5+ options exist)
- [ ] Filter by "has swatches" / "text only"
- [ ] Sort by: name, value count, last modified

---

### Phase 7.3: Variant Matrix Improvements

#### Enhanced Matrix Table

- [ ] Sticky header row and first column (for scrolling large matrices)
- [ ] Column resize handles
- [ ] Keyboard navigation (Tab, Arrow keys, Enter to edit)
- [ ] Cell selection (click) with multi-select (Shift+Click, Ctrl+Click)
- [ ] Paste from Excel/Google Sheets (Ctrl+V on selected cells)

#### Bulk Operations Toolbar

- [ ] "Fill Down" - apply selected cell value to cells below
- [ ] "Fill Selection" - apply value to all selected cells
- [ ] "Clear Selection" - reset selected cells to defaults
- [ ] "Auto-generate SKUs" - regenerate SKUs for selection
- [ ] "Import Prices from CSV"
- [ ] "Export Matrix to CSV"

#### Visual Enhancements

- [ ] Swatch preview in variant rows (show color circle/image thumbnail)
- [ ] Stock status indicator per row (green/yellow/red dot)
- [ ] Price comparison to base price (show +/- difference)
- [ ] Image thumbnail per variant (if assigned)

#### Performance Optimization

- [ ] Virtualized table for 100+ variants (react-virtual or tanstack-virtual)
- [ ] Lazy load variant images
- [ ] Debounced updates (batch changes)
- [ ] Pagination for extremely large matrices (500+ variants)

---

### Phase 7.4: Variant Images per Option Value

#### Concept

When customer selects "Blue" color, product gallery shows blue product images automatically.

#### Implementation

- [ ] Add `image_media_ids` array to `variant_option_values` (for color/pattern options)
- [ ] Or: Add `option_value_images` junction table
- [ ] Option value → multiple images mapping
- [ ] In product form: assign images to option values
- [ ] Storefront: filter gallery by selected option value

#### UI Components

- [ ] "Assign Images" button per option value in options manager
- [ ] Image assignment modal (multi-select from product images)
- [ ] Preview thumbnails showing assigned images
- [ ] Storefront gallery filtering on option change

---

### Phase 7.5: Smart Variant Generation (AI-Assisted)

#### Auto-Suggest Option Values

- [ ] Based on product category, suggest common options
  - Clothing → Size, Color
  - Electronics → Storage, Color
  - Footwear → Size, Width
- [ ] Based on product name/description, suggest values
  - "Blue T-Shirt" → suggest "Blue" as color value
- [ ] Integration point for future AI API calls

#### Smart SKU Generation

- [ ] Configurable SKU patterns per store
  - Pattern: `{product_code}-{color_abbr}-{size}`
  - Example: `TSH-BLU-M`
- [ ] Auto-abbreviation rules (Blue → BLU, Medium → M)
- [ ] Collision detection and resolution

#### Variant Pricing Suggestions

- [ ] Suggest price adjustments based on market data (future)
- [ ] "Similar products" pricing reference
- [ ] Tier pricing auto-calculation

---

### Phase 7.6: Accessibility & Mobile

#### Accessibility Requirements

- [ ] ARIA labels on all swatch buttons (`aria-label="Select Blue color"`)
- [ ] `role="radiogroup"` for swatch groups
- [ ] `aria-selected` state on selected swatch
- [ ] Keyboard focus ring visible
- [ ] `aria-disabled` for out-of-stock variants
- [ ] Screen reader announcements on selection change

#### Mobile Optimizations

- [ ] Touch-friendly swatch size (minimum 44×44px tap target)
- [ ] Horizontal scroll for many swatches (with scroll indicators)
- [ ] Collapsible option groups on mobile (accordion style)
- [ ] Bottom sheet variant selector for mobile PDP
- [ ] Haptic feedback on selection (native apps, future)

---

### Phase 7.7: Store Settings & Configuration

#### Variant Display Settings

- [ ] Add to store settings: "Variant Display" section
- [ ] Toggle: Show swatches on product cards (collection pages)
- [ ] Toggle: Show stock status on variants
- [ ] Toggle: Allow backorder for out-of-stock variants
- [ ] Select: Default variant display mode (dropdown / swatches / matrix)

#### Inventory Settings

- [ ] Low stock threshold per variant (override product-level)
- [ ] "Hide when out of stock" option per variant
- [ ] Pre-order/backorder settings per variant

---

### Files to Create

- [ ] `lib/db/schema.ts` - Update variant_option_values with swatch fields
- [ ] `components/dashboard/variants/swatch-editor.tsx`
- [ ] `components/dashboard/variants/bulk-value-input.tsx`
- [ ] `components/dashboard/variants/option-templates.tsx`
- [ ] `components/store/variant-swatch-selector.tsx`
- [ ] `lib/variants/sku-generator.ts` - Configurable SKU patterns
- [ ] `lib/variants/option-templates.ts` - Pre-defined option sets

### Files to Modify

- [ ] `components/dashboard/variants/variant-options-manager.tsx` - Major overhaul
- [ ] `components/dashboard/products/variant-matrix-table.tsx` - Enhancements
- [ ] `components/store/product-detail.tsx` - Swatch selector integration
- [ ] `components/store/product-card.tsx` - Optional swatch display

---

### Implementation Priority

**High Priority (Core UX):**

1. Visual swatch system (color/image)
2. Drag-to-reorder options/values
3. Storefront swatch selector
4. Accessibility compliance

**Medium Priority (Power User Features):** 5. Bulk value management 6. Matrix table enhancements 7. Option templates 8. Variant images per option value

**Lower Priority (Advanced):** 9. AI-assisted suggestions 10. Configurable SKU patterns 11. Cross-platform sync (future)

---

### Research Sources

- [Shopify 2,048 Variants Announcement](https://www.shopify.com/blog/2048-variants)
- [Shopify Variant Best Practices - Prediko](https://www.prediko.io/blog/shopify-variant-limit)
- [BigCommerce Variants vs Modifiers](https://blog.yourstorewizards.com/variants-vs-modifiers-in-bigcommerce/)
- [Amazon Variation Listings Guide](https://sell.amazon.com/blog/amazon-variation-listing)
- [Baymard: Mobile Color Swatches](https://baymard.com/blog/mobile-interactive-color-swatches)
- [Product Variants UX Guide - Number Analytics](https://www.numberanalytics.com/blog/ultimate-guide-product-variants-ux-ecommerce)
- [WooCommerce Bulk Variations - Barn2](https://barn2.com/wordpress-plugins/woocommerce-bulk-variations/)
- [Magento Product Matrix - Webkul](https://store.webkul.com/magento2-product-matrix.html)
- [AI in PIM Systems - Netguru](https://www.netguru.com/blog/ai-in-pim-systems)
- [The State of UX 2025](https://trends.uxdesign.cc)
- [Color Swatches UX - Searchanise](https://searchanise.io/blog/color-swatches/)

---

## Future Enhancements (Post-MVP)

- [ ] Multi-language support (Dari, Pashto, English)
- [ ] Payment gateway integration (local Afghan options)
- [x] Email notifications (via Novu)
- [ ] SMS notifications (WhatsApp API)
- [ ] Discount codes / coupons
- [x] Customer accounts (order history, saved addresses) - Phase 3.5
- [x] Wishlist functionality - Phase 3.5
- [ ] Store themes/templates
- [x] Custom domain support (Caddy on-demand TLS) - See `docs/CUSTOM_DOMAINS.md`
- [x] Admin panel for platform management - `/admin` route
- [x] Offline POS support (PWA with Dexie + Serwist) - See `docs/OFFLINE_SYNC_ROADMAP.md`
