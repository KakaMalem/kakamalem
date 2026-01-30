# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Kaka Malem** is a multitenant shop builder SaaS application targeting the Afghan market. Users can create and manage their own online stores through the platform. Default currency is AFN (Afghan Afghani).

## Development Commands

```bash
pnpm dev          # Start development server with Turbopack
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint
```

Database commands (Drizzle):

```bash
pnpm db:generate       # Generate migration files from schema changes
pnpm db:migrate        # Apply migrations from drizzle/ folder
pnpm db:migrate:custom # Apply custom SQL (triggers, functions) from drizzle/custom/
pnpm db:studio         # Open Drizzle Studio GUI
pnpm db:push           # Push schema directly (DEV ONLY - can cause data loss!)
```

## Database Migration Workflow

**IMPORTANT: Always use migrations, never use `db:push` in production!**

### Making Schema Changes

1. **Edit the schema** in `lib/db/schema.ts`
2. **Generate migration**:
   ```bash
   pnpm db:generate
   ```
3. **Review the generated SQL** in `drizzle/XXXX_*.sql`
4. **Commit the migration**:
   ```bash
   git add drizzle/
   git commit -m "migration: description of changes"
   ```
5. **Push to deploy** - migrations run automatically via `deploy.sh`

### Why NOT to use db:push

- No migration history (can't rollback)
- No team collaboration (no files to review)
- Can accidentally drop columns/data

### Custom SQL Migrations (Triggers, Functions)

Drizzle-kit doesn't manage triggers, functions, or other custom SQL. Use the custom migration system:

1. **Create SQL file** in `drizzle/custom/` with numbered prefix (e.g., `0001_my_trigger.sql`)
2. **Run migrations**:
   ```bash
   pnpm db:migrate:custom
   ```
3. **Tracks applied migrations** in `custom_migrations` table (safe to re-run)

Add shadcn/ui components:

```bash
pnpm dlx shadcn-ui@latest add [component-name]
```

## Deployment

Automated deployment via GitHub Actions with **zero-downtime blue-green deployments**. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full setup.

**Quick deploy**: Push to `main` branch

```bash
git push origin main
```

**Manual deployment on VPS**:

```bash
cd /var/www/kakamalem
./scripts/docker-deploy.sh          # Pull and deploy (zero-downtime)
./scripts/docker-deploy.sh --build  # Build locally and deploy
./scripts/docker-deploy.sh --status # Check deployment status
```

**Rollback**:

```bash
./scripts/docker-deploy.sh --rollback
```

### Blue-Green Deployment

The deployment uses blue-green strategy for zero downtime:

- Two containers: `kakamalem-blue` (port 3000) and `kakamalem-green` (port 3001)
- Nginx upstream switches between them during deployment
- New container starts and passes health check before traffic switches
- Old container stops only after traffic has moved

## Infrastructure (Docker + Native Hybrid)

The production setup uses a hybrid approach for optimal performance:

| Component     | Where      | Why                                               |
| ------------- | ---------- | ------------------------------------------------- |
| Next.js App   | Docker     | Portable, reproducible, easy rollback             |
| PostgreSQL 18 | Native     | Performance, tuned configs in `database/`         |
| PgBouncer     | Native     | Minimal overhead, connection pooling              |
| Nginx         | Native     | SSL termination, static files faster              |
| Caddy         | Native     | Custom domains with on-demand TLS (automatic SSL) |
| File Storage  | Bind mount | Docker accesses native filesystem                 |

### Custom Domains

Stores can connect custom domains (e.g., `shop.mybrand.com`) via Caddy's on-demand TLS:

- Automatic SSL certificate provisioning via Let's Encrypt
- Domain verification via DNS TXT record
- Configured in store settings (`/dashboard/[slug]/settings/domain`)
- See [docs/CUSTOM_DOMAINS.md](docs/CUSTOM_DOMAINS.md) for setup details

### Docker Deployment

```bash
# Pull and deploy latest image
cd /var/www/kakamalem
docker compose pull
docker compose up -d

# View logs
docker compose logs -f app

# Rollback to previous version
./scripts/docker-deploy.sh --rollback
```

### Server Setup (Fresh Ubuntu)

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for complete setup guide.

### Key Infrastructure Files

```
Dockerfile              # Multi-stage build for Next.js
docker-compose.yml      # App orchestration (DB runs native)
.dockerignore           # Exclude files from Docker context
docs/DEPLOYMENT.md      # Complete deployment guide

scripts/
├── docker-deploy.sh    # Docker deployment with rollback
├── backup-database.sh  # PostgreSQL backup with rotation
└── health-check.sh     # System health verification

.github/workflows/
├── ci.yml              # Lint, type check, build
└── docker.yml          # Build & push Docker image to GHCR
```

### Database Backups

```bash
# Manual backup
./scripts/backup-database.sh

# Backup with cleanup (removes backups older than 14 days)
./scripts/backup-database.sh --cleanup

# Cron (daily at 3 AM)
0 3 * * * /var/www/kakamalem/scripts/backup-database.sh --cleanup
```

### Health Check Endpoint

`GET /api/health` returns:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 86400,
  "checks": {
    "database": { "status": "ok", "latency": 5 }
  }
}
```

## Tech Stack

- **Framework**: Next.js 16 with App Router (RSC by default)
- **Language**: TypeScript 5 (strict mode)
- **Styling**: Tailwind CSS 4 with CSS variables in OKLCH color space
- **State Management**: Zustand (for client-side state like cart)
- **Data Fetching**: React Query (for client-side data fetching/caching)
- **Database**: PostgreSQL 18 with PgBouncer + Drizzle ORM
- **Authentication**: Better Auth (email/password, Google OAuth, Facebook OAuth)
- **File Storage**: Local NVMe storage (served via Next.js API route)
- **UI Components**: shadcn/ui (new-york style)
- **Validation**: Zod
- **Notifications**: Novu (in-app + push notifications)
- **Offline/PWA**: Dexie.js (IndexedDB) + Serwist (Service Worker)
- **Custom Domains**: Caddy with on-demand TLS
- **Package Manager**: pnpm

## Architecture

### Multitenancy Model

Path-based routing following [Next.js multi-tenant guide](https://nextjs.org/docs/app/guides/multi-tenant):

- **Public storefronts**: `kakamalem.com/store/[slug]`
- **Store management**: `kakamalem.com/dashboard`
- **All tenant data isolated** via `tenant_id` foreign key + application-level checks
- **Tenant-isolated carts**: Each shop has separate carts (no cross-shop cart)

### App Router Structure

```
app/
├── layout.tsx              # Root layout (Geist fonts, metadata)
├── page.tsx                # Landing page
├── globals.css             # Tailwind + CSS theme variables
├── (auth)/                 # Route group: platform auth
│   ├── login/              # Email/password + OAuth login
│   ├── signup/             # User registration
│   ├── confirm/            # Email confirmation page
│   ├── error/              # Auth error page
│   └── logout/             # Logout handler
├── admin/                  # Platform admin panel (/admin)
│   ├── page.tsx            # Admin dashboard
│   ├── stores/             # Store management
│   └── settings/           # Platform settings
├── dashboard/              # Store owner dashboard (protected)
│   ├── page.tsx            # Store selector
│   ├── new/                # Create new store
│   ├── account/            # User account settings
│   └── [slug]/             # Per-store dashboard
│       ├── page.tsx        # Store dashboard home
│       ├── products/       # Product management
│       ├── categories/     # Category management
│       ├── orders/         # Order management
│       ├── offline-sales/  # POS/offline sales
│       ├── inventory/      # Stock management
│       ├── analytics/      # Store analytics
│       ├── shipping/       # Shipping methods
│       ├── customers/      # Customer groups
│       ├── variants/       # Variant options (Size, Color, etc.)
│       ├── media/          # Media library
│       ├── settings/       # Store settings
│       └── billing/        # Subscription management
├── store/[slug]/           # Public storefront for each tenant
│   ├── (auth)/             # Store-specific customer auth
│   │   └── auth/           # Login, signup, forgot-password
│   └── (storefront)/       # Public pages
│       ├── page.tsx        # Store homepage
│       ├── products/       # Product listing
│       ├── product/[slug]/ # Product detail
│       ├── category/[slug]/# Category view
│       ├── cart/           # Shopping cart
│       ├── checkout/       # Checkout flow
│       └── account/        # Customer account (orders, addresses, wishlist)
├── privacy/                # Privacy policy
├── terms/                  # Terms of service
└── data-deletion/          # Data deletion request (Facebook requirement)
```

### Admin Panel (/admin)

Platform administration accessible only to `platform_admin` or `super_admin` users.

- **Dashboard**: Platform stats, trial warnings, expired trials
- **Stores**: List, search, filter, suspend/activate stores
- **Settings**: Configure subscription pricing, trial duration, product limits

### Key Directories

```
lib/
├── db/
│   ├── index.ts            # Drizzle client
│   ├── schema.ts           # Database schema (see below)
│   └── queries/            # Reusable query functions (20+ files)
├── auth/
│   ├── index.ts            # Better Auth configuration
│   ├── client.ts           # Client-side auth hooks
│   └── server.ts           # Server-side auth helpers
├── storage/
│   └── index.ts            # Local file storage utilities
├── actions/                # Server actions for data mutations (22+ files)
├── stores/                 # Zustand stores for client state
├── validations/            # Zod schemas for forms
└── utils.ts                # cn() helper for Tailwind classes

components/
├── ui/                     # shadcn/ui components
├── auth/                   # Auth-related components
├── dashboard/              # Dashboard page components
└── store/                  # Storefront components

database/                   # PostgreSQL configuration files
├── postgresql.conf         # Optimized PostgreSQL 18 config
├── pg_hba.conf            # Client authentication config
└── pgbouncer.ini          # Connection pooling config
```

### Client-Side State (Zustand)

Location: `lib/stores/`

| Store                          | Purpose                                 |
| ------------------------------ | --------------------------------------- |
| `use-cart-store.ts`            | Shopping cart state per tenant          |
| `use-checkout-store.ts`        | Checkout flow state (address, shipping) |
| `use-tenant-settings-store.ts` | Cached tenant settings for storefront   |

### Path Alias

`@/*` maps to project root. Use: `@/lib/utils`, `@/components/ui/button`

## Database Schema

### Core Tables

| Table            | Purpose                                                     |
| ---------------- | ----------------------------------------------------------- |
| `profiles`       | User profiles linked to Better Auth (id = user.id)          |
| `tenants`        | Stores/storefronts with branding, billing status, analytics |
| `tenant_members` | Staff/collaborators per store (owner, admin, staff roles)   |
| `categories`     | Product categories per tenant (image, displayOrder)         |
| `products`       | Products with optional variants support                     |
| `media`          | Centralized media library (tenant-isolated)                 |
| `product_images` | Junction: products <-> media                                |

### Inventory & Variants

| Table                     | Purpose                                           |
| ------------------------- | ------------------------------------------------- |
| `variant_options`         | Option types per tenant (Size, Color, Material)   |
| `variant_option_values`   | Values per option (S, M, L, XL for Size)          |
| `product_variants`        | SKUs with own price/stock (Blue T-Shirt - Size M) |
| `product_variant_options` | Junction: variants <-> option values              |
| `inventory_movements`     | Audit log for all stock changes                   |

### Orders & Shipping

| Table                                    | Purpose                                                      |
| ---------------------------------------- | ------------------------------------------------------------ |
| `carts` / `cart_items`                   | Shopping carts (session or customer based)                   |
| `orders` / `order_items`                 | Orders with address, financial breakdown                     |
| `offline_orders` / `offline_order_items` | POS/in-store sales (no shipping required)                    |
| `shipping_zones`                         | Geographic regions (countries, states, cities, postal codes) |
| `shipping_methods`                       | Delivery options per zone (flat, weight-based, price-based)  |
| `delivery_zones`                         | Local delivery areas with polygon/radius boundaries          |
| `shipments`                              | Physical shipments with tracking                             |
| `shipment_items`                         | Which items in each shipment (split shipment support)        |
| `shipment_tracking_events`               | Tracking history                                             |

### Customers & Pricing

| Table                          | Purpose                                             |
| ------------------------------ | --------------------------------------------------- |
| `customer_groups`              | Customer segments per tenant (VIP, Wholesale, etc.) |
| `customer_group_members`       | Junction: customers <-> groups                      |
| `price_tiers`                  | Quantity-based pricing (buy 10+ get discount)       |
| `group_pricing`                | Special prices per customer group                   |
| `scheduled_sales`              | Time-limited discounts (start/end date)             |
| `wishlists` / `wishlist_items` | Customer wishlists per tenant                       |

### Reviews & Billing

| Table                     | Purpose                                                       |
| ------------------------- | ------------------------------------------------------------- |
| `reviews`                 | Product reviews (1-5 stars, owner replies, verified purchase) |
| `review_media`            | Customer-uploaded review images                               |
| `commission_transactions` | Platform commission audit log                                 |

### Analytics (System-Managed)

| Table                            | Purpose                                     |
| -------------------------------- | ------------------------------------------- |
| `analytics_daily_snapshots`      | Daily aggregated metrics                    |
| `analytics_hourly_metrics`       | Real-time dashboard data                    |
| `analytics_product_performance`  | Per-product daily metrics                   |
| `analytics_category_performance` | Per-category daily metrics                  |
| `analytics_traffic_sources`      | UTM/referrer tracking                       |
| `analytics_geographic_sales`     | Sales by location                           |
| `analytics_page_views`           | Raw page view events                        |
| `analytics_conversion_events`    | Funnel events (add_to_cart, checkout, etc.) |

## Analytics Dashboard

The analytics dashboard at `/dashboard/[slug]/analytics` provides store owners with performance insights.

### Available Features

| Feature                 | Component                   | Data Source                          |
| ----------------------- | --------------------------- | ------------------------------------ |
| Revenue & Orders Charts | `RevenueTrendChart`         | Orders table aggregation             |
| KPI Cards               | `EnhancedAnalyticsKPICards` | `getEnhancedKPIs()`                  |
| Top Products            | `AnalyticsTopProducts`      | Order items aggregation              |
| Customer Split          | `CustomerSplitCard`         | New vs returning customers           |
| Category Distribution   | `CategoryDistributionChart` | `/api/analytics/categories`          |
| Sales Heatmap           | `SalesHeatmap`              | `/api/analytics/heatmap`             |
| Product Performance     | `ProductPerformanceTable`   | `/api/analytics/products`            |
| Real-time Metrics       | `RealTimeIndicator`         | `/api/analytics/realtime` (30s poll) |
| Geographic Sales        | -                           | `/api/analytics/geographic`          |

### Query Functions

Location: `lib/db/queries/analytics.ts`

| Function                   | Returns                                          |
| -------------------------- | ------------------------------------------------ |
| `getAnalyticsData()`       | KPIs, daily data, top products                   |
| `getEnhancedKPIs()`        | Extended KPIs (items per order, etc.)            |
| `getCategoryPerformance()` | Revenue/orders by category                       |
| `getSalesHeatmap()`        | Order count by hour × day-of-week (168 points)   |
| `getProductPerformance()`  | Paginated product metrics                        |
| `getConversionFunnel()`    | Purchase funnel (partial - needs event tracking) |
| `getGeographicSales()`     | Sales by country/state/city                      |
| `getTrafficSources()`      | Placeholder (needs UTM tracking)                 |

### Time Range Options

- `today`, `yesterday`, `7d`, `30d`, `90d`
- `this_month`, `last_month`, `this_year`
- `custom` (with start/end dates)

### Not Yet Implemented

These features require analytics event tracking to be implemented:

- Full conversion funnel (product_view → add_to_cart → checkout_start → purchase)
- Traffic sources (UTM parameter capture)
- Cart abandonment rate
- Product page views

### Enums

- **User roles** (`profiles.role`): `admin`, `owner`, `staff`, `customer`
- **Tenant member roles**: `owner`, `admin`, `staff`
- **Tenant status**: `pending_review`, `active`, `suspended`, `inactive`
- **Subscription plan**: `free`, `pro`
- **Subscription status**: `trialing`, `active`, `past_due`, `cancelled`, `expired`
- **Order status**: `pending`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`, `refunded`, `partially_refunded`
- **Stock status**: `in_stock`, `low_stock`, `out_of_stock`, `on_backorder`
- **Shipment status**: `pending`, `picked_up`, `in_transit`, `out_for_delivery`, `delivered`, `failed`, `returned`
- **Store mode**: `full`, `online_only`, `offline_only`, `catalog`

### Store Modes

| Mode           | Online Cart | Checkout | POS/Offline | Use Case                        |
| -------------- | ----------- | -------- | ----------- | ------------------------------- |
| `full`         | Yes         | Yes      | Yes         | Omnichannel (default)           |
| `online_only`  | Yes         | Yes      | No          | E-commerce only                 |
| `offline_only` | No          | No       | Yes         | Physical store, POS only        |
| `catalog`      | No          | No       | No          | Showcase products, contact only |

When `store_mode` is `catalog` or `offline_only`, the storefront disables the cart drawer and shows appropriate CTAs (contact info or "visit in-store").

### Subscription/Billing Model

Simple subscription model (no transaction fees):

1. **Free Plan**: 7-day trial, 20 product limit, all features included
2. **Pro Plan**: 1,100 AFN/month per store, unlimited products

Settings are configurable from admin panel (`/admin`).

**Subscription States:**

- `trialing` - In free trial period (7 days default)
- `active` - Paid subscription in good standing
- `past_due` - Payment failed, in grace period
- `cancelled` - Cancelled but access until period end
- `expired` - Trial/subscription expired, needs upgrade

**Suspension is manual** - admins review and suspend stores via the admin panel.

## Authorization

### Role Hierarchy

- **Owner** > **Admin** > **Staff** (per-tenant via `tenant_members`)
- Platform admin role via `user_profiles.platform_role = 'platform_admin'` or `'super_admin'`

### Authorization Model

Authorization is enforced at the **application level** (not database RLS):

- All queries filter by `tenant_id` for tenant isolation
- Server actions check permissions via `lib/auth/context.ts` helpers:
  - `getUserStoreContext(tenantId)` - Get user's relationship to a store
  - `canManageStore(tenantId)` - Check if user can manage store
  - `hasMinimumRole(tenantId, role)` - Check role hierarchy
- Platform admin access checked via `isPlatformAdmin()` in `lib/auth/server.ts`

### Auto Profile Creation

Better Auth creates `user_profiles` automatically via database hooks when users sign up.

## Validation Patterns

### Zod Schemas

Location: `lib/validations/`

```typescript
// Example: lib/validations/auth.ts
export const loginSchema = z.object({
  email: z.email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
```

### Form Validation Pattern

```typescript
// Client-side
const [errors, setErrors] = useState<Partial<Record<keyof InputType, string>>>(
  {}
);

const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  setErrors({});

  const result = schema.safeParse(formData);
  if (!result.success) {
    const fieldErrors: typeof errors = {};
    result.error.issues.forEach((issue) => {
      const field = issue.path[0] as keyof InputType;
      fieldErrors[field] = issue.message;
    });
    setErrors(fieldErrors);
    return;
  }

  // Submit to server action
};
```

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

## Styling Guidelines

- **Mobile-first**: Always write mobile styles first, use responsive prefixes for larger screens
- **No dark mode**: Do not use `dark:` variants
- Use `cn()` helper for conditional classes:
  ```typescript
  import { cn } from "@/lib/utils";
  <div className={cn("base-class", condition && "conditional-class")} />;
  ```
- Theme colors in `globals.css` as CSS variables (OKLCH color space)
- shadcn/ui components use CSS variables for theming

## Authentication Flow

Using Better Auth (https://www.better-auth.com) - a self-hosted, PostgreSQL-backed auth solution.

### Email/Password

1. User submits form → client-side Zod validation
2. Better Auth handles signup/signin via `/api/auth/[...all]` route
3. For signup: email confirmation sent → user clicks link → verified
4. Session stored in cookies (HTTP-only, secure)

### OAuth (Google/Facebook)

1. User clicks OAuth button → redirects to provider
2. Provider redirects back to `/api/auth/callback/{provider}`
3. Better Auth exchanges code for session
4. Redirect to `/dashboard`

### Auth Helpers

```typescript
// lib/auth/server.ts - Server-side
import { auth } from "@/lib/auth";
const session = await auth.api.getSession({ headers: await headers() });

// Additional server helpers:
// - getUser() - Get current user (cached)
// - getUserProfile() - Get user's extended profile
// - requireAuth() - Require auth (throws if not authenticated)
// - isPlatformAdmin() - Check if user is platform/super admin
// - requirePlatformAdmin() - Require admin access (throws if not)
// - getPortalAccess() - Get all user's portal access (seller, staff, affiliate, delivery)
// - hasStoreAccess(tenantId) - Check store access with role

// lib/auth/context.ts - Store context helpers
// - getUserStoreContext(tenantId) - Get user's relationship to a store
// - canManageStore(tenantId) - Check if user can manage store
// - hasMinimumRole(tenantId, role) - Check role hierarchy
// - getUserAddresses() - Get user's saved addresses

// lib/auth/client.ts - Client-side
import { authClient } from "@/lib/auth/client";
const { data: session } = authClient.useSession();
```

## Environment Variables

### Production (`.env`)

```bash
# PostgreSQL 18 via PgBouncer (pooled for app runtime)
DATABASE_URL="postgresql://kakamalem_app:password@localhost:6543/kakamalem"

# PostgreSQL 18 direct (for drizzle-kit migrations)
DATABASE_URL_UNPOOLED="postgresql://kakamalem_migrations:password@localhost:5432/kakamalem"

# Better Auth secret (generate with: openssl rand -base64 32)
BETTER_AUTH_SECRET="your-secret-key"

# App URL for auth redirects
NEXT_PUBLIC_APP_URL="https://kakamalem.com"

# Local file storage path
STORAGE_PATH="/var/www/kakamalem-uploads"
```

### Local Development (`.env.local`)

```bash
# Local PostgreSQL (no pooling needed)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/kakamalem"
DATABASE_URL_UNPOOLED="postgresql://postgres:postgres@localhost:5432/kakamalem"

# Better Auth
BETTER_AUTH_SECRET="dev-secret-at-least-32-characters-long"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Local storage path (Windows example)
STORAGE_PATH="C:/Users/YourName/kakamalem-uploads"
```

**Note:** `.env.local` takes precedence over `.env` in Next.js. Delete or rename `.env.local` to use production environment.

## Offline/PWA Support

The POS system supports offline operation via Progressive Web App (PWA) technology:

- **Service Worker**: Serwist for caching and offline support
- **IndexedDB**: Dexie.js for local data storage
- **Offline Sales**: POS can process sales offline, synced when back online
- **Background Sync**: Queued operations synced automatically

Key files:

- `lib/offline/` - Dexie database and sync logic
- `app/sw.ts` - Service worker configuration
- See [docs/OFFLINE_SYNC_ROADMAP.md](docs/OFFLINE_SYNC_ROADMAP.md) for architecture

## Notifications

Using Novu for multi-channel notifications:

- **In-App**: Real-time notifications in dashboard
- **Email**: Order confirmations, shipping updates
- **Push**: Browser push notifications (optional)

Key files:

- `lib/notifications/` - Novu client and helpers
- Configured via `NOVU_API_KEY` environment variable

## SEO

Dynamic SEO configuration per store:

- **Sitemaps**: Auto-generated at `/sitemap.xml` (dynamic per store)
- **Robots.txt**: Dynamic at `/robots.txt`
- **Meta Tags**: Per-page via Next.js `generateMetadata`
- **Structured Data**: JSON-LD for products and organization

## Development Notes

- **No test framework** configured yet
- **ESLint 9+** flat config in `eslint.config.mjs`
- **React Server Components** enabled by default
- **Rich text editor**: TipTap (used for product descriptions)
- Components in `components/ui/` are shadcn/ui (don't modify directly unless necessary)
- For new features, create server actions in appropriate `lib/` subdirectory

## Common Patterns

### Server Component Data Fetching

```typescript
// app/store/[slug]/page.tsx
export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  // ...
}
```

### Client Component with Server Action

```typescript
"use client";

import { serverAction } from "@/lib/actions";

export function MyForm() {
  const handleSubmit = async (formData: FormData) => {
    const result = await serverAction(formData);
    // handle result
  };
  // ...
}
```

### Tenant-Scoped Queries

Always filter by `tenant_id`:

```typescript
const products = await db.query.products.findMany({
  where: eq(products.tenantId, tenantId),
});
```
