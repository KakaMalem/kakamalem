# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Kaka Malem** is a multitenant shop builder SaaS application. Users can create and manage their own online stores through the platform.

## Development Commands

```bash
pnpm dev      # Start development server with hot reload
pnpm build    # Production build
pnpm start    # Start production server
pnpm lint     # Run ESLint
```

Database commands (Drizzle):

```bash
pnpm db:generate  # Generate migrations from schema changes
pnpm db:push      # Push schema directly to database (dev)
pnpm db:migrate   # Run migrations (production)
pnpm db:studio    # Open Drizzle Studio GUI
```

Add shadcn/ui components:

```bash
pnpm dlx shadcn-ui@latest add [component-name]
```

## Tech Stack

- **Framework**: Next.js 16 with App Router (not Pages Router)
- **Language**: TypeScript 5 (strict mode enabled)
- **Styling**: Tailwind CSS 4 with CSS variables in OKLCH color space
- **State Management**: Zustand
- **Database**: Supabase PostgreSQL with Drizzle ORM (multitenant data model)
- **File Storage**: Supabase Storage (for product images, shop assets)
- **UI Components**: shadcn/ui (new-york style, configured but components not yet added)
- **Package Manager**: pnpm

## Architecture

**Multitenancy Model** (follows [Next.js multi-tenant guide](https://nextjs.org/docs/app/guides/multi-tenant)):

- Path-based routing: `kakamalem.com/store/[store-slug]` for individual stores
- Main app routes: `kakamalem.com/dashboard` for store management
- Dynamic route `app/store/[slug]/` handles tenant resolution
- All tenant data isolated via `tenant_id` foreign key
- Carts, checkout, and orders are tenant-isolated (separate cart per shop, not cross-shop)

**Multi-Zones** (see [Next.js multi-zones guide](https://nextjs.org/docs/app/guides/multi-zones)):

- Not currently using multi-zones (single Next.js app)
- If splitting into zones later: use `<a>` tags (not `<Link>`) for cross-zone navigation

**App Router Structure**:

- `app/layout.tsx` - Root layout with Geist fonts and metadata
- `app/page.tsx` - Landing page
- `app/globals.css` - Tailwind imports and CSS theme variables
- `app/store/[slug]/` - Public storefront for each tenant
- `app/dashboard/` - Store owner dashboard
- `app/(auth)/login/` and `app/(auth)/signup/` - Authentication pages

**Key Utilities**:

- `lib/utils.ts` - Contains `cn()` function for merging Tailwind classes safely (clsx + tailwind-merge)
- `lib/db/index.ts` - Drizzle database client
- `lib/db/schema.ts` - Database schema (tenants, products, categories, carts, orders)

**Path Alias**: `@/*` maps to project root (use `@/lib/utils`, `@/components/...`)

## Styling Patterns

- **Mobile-first design** - ALWAYS write mobile styles first.
- Use Tailwind utility classes
- Use `cn()` helper when conditionally combining classes
- Theme colors defined as CSS variables in globals.css
- **No dark mode** - do not use `dark:` variants or implement dark mode features

## Database

Environment variables for Supabase are in `.env` (see `.env.example`):

- `DATABASE_URL` - Supabase PostgreSQL connection string (pooler URI)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous/public key

**Schema** (`lib/db/schema.ts`):

- `profiles` - User profiles linked to Supabase Auth (id, email, role)
- `tenant_members` - Staff/collaborators per store (userId, tenantId, role) - unique per user/tenant
- `tenants` - Stores (id, slug, name, ownerId, currency, isActive)
- `categories` - Product categories per tenant (image, displayOrder) - unique slug per tenant
- `products` - Products (price, stock, displayOrder) - unique slug per tenant
- `media` - Centralized media library (tenant-isolated, tracks uploader, reusable across products)
- `product_images` - Junction table linking products to media (position for ordering)
- `carts` - Shopping carts per tenant/session
- `cart_items` - Items in carts - unique product per cart
- `orders` - Customer orders per tenant (status enum: pending/confirmed/processing/shipped/delivered/cancelled)
- `order_items` - Line items in orders
- `reviews` - Product reviews (rating 1-5, comment, verified purchase flag, approval status)

**Authorization Model**:

- `profiles.role` - Global user roles: `admin`, `owner`, `staff`, `customer`
- `tenant_members.role` - Per-store roles: `owner`, `admin`, `staff`
- Supabase Auth handles authentication, `profiles` table extends with app-specific data
- Profile ID matches Supabase Auth user UUID

**Multitenancy Pattern**:

- All tenant-scoped tables include `tenant_id` column
- Use Supabase Row Level Security (RLS) policies for tenant data isolation
- Drizzle queries should always filter by `tenant_id` from authenticated context

**RLS Policies** (`supabase/migrations/001_rls_policies.sql`):

- `check_tenant_access(tenant_id, role)` - Helper function with role hierarchy (owner > admin > staff)
- Uses `SECURITY DEFINER` for performance (bypasses RLS on helper queries)
- Public can view: active tenants, categories, active products, approved reviews, media
- Staff+ can: manage products, categories, media, view orders, moderate reviews
- Admin+ can: delete products/categories/orders/media, manage tenant members
- Owner can: update/delete tenant, manage all members
- Auto-creates profile on user signup via trigger on `auth.users`

## Notes

- No test framework configured
- ESLint 9+ flat config format in `eslint.config.mjs`
- React Server Components enabled by default
