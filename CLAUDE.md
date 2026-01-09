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
pnpm db:generate  # Generate migration files from schema changes
pnpm db:migrate   # Apply migrations from drizzle/ folder
pnpm db:studio    # Open Drizzle Studio GUI
pnpm db:push      # Push schema directly (DEV ONLY - clears RLS!)
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

| Component     | Where      | Why                                       |
| ------------- | ---------- | ----------------------------------------- |
| Next.js App   | Docker     | Portable, reproducible, easy rollback     |
| PostgreSQL 18 | Native     | Performance, tuned configs in `database/` |
| PgBouncer     | Native     | Minimal overhead, connection pooling      |
| Nginx         | Native     | SSL termination, static files faster      |
| File Storage  | Bind mount | Docker accesses native filesystem         |

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
- **Database**: PostgreSQL 18 with PgBouncer + Drizzle ORM
- **Authentication**: Better Auth (email/password, Google OAuth, Facebook OAuth)
- **File Storage**: Local NVMe storage (served via Next.js API route)
- **UI Components**: shadcn/ui (new-york style)
- **Validation**: Zod
- **Package Manager**: pnpm

## Architecture

### Multitenancy Model

Path-based routing following [Next.js multi-tenant guide](https://nextjs.org/docs/app/guides/multi-tenant):

- **Public storefronts**: `kakamalem.com/store/[slug]`
- **Store management**: `kakamalem.com/dashboard`
- **All tenant data isolated** via `tenant_id` foreign key + RLS policies
- **Tenant-isolated carts**: Each shop has separate carts (no cross-shop cart)

### App Router Structure

```
app/
├── layout.tsx              # Root layout (Geist fonts, metadata)
├── page.tsx                # Landing page
├── globals.css             # Tailwind + CSS theme variables
├── auth/
│   ├── login/              # Email/password + OAuth login
│   ├── signup/             # User registration
│   ├── callback/route.ts   # OAuth callback handler
│   ├── confirm/            # Email confirmation page
│   ├── error/              # Auth error page
│   └── logout/             # Logout handler
├── dashboard/              # Store owner dashboard (protected)
└── store/[slug]/           # Public storefront for each tenant
```

### Key Directories

```
lib/
├── db/
│   ├── index.ts            # Drizzle client
│   ├── schema.ts           # Database schema (see below)
│   └── queries/            # Reusable query functions
├── auth/
│   ├── index.ts            # Better Auth configuration
│   ├── client.ts           # Client-side auth hooks
│   └── server.ts           # Server-side auth helpers
├── storage/
│   └── index.ts            # Local file storage utilities
├── actions/                # Server actions for data mutations
├── validations/
│   └── auth.ts             # Zod schemas for auth forms
└── utils.ts                # cn() helper for Tailwind classes

components/
├── ui/                     # shadcn/ui components
└── auth/                   # Auth-related components

database/                   # PostgreSQL configuration files
├── postgresql.conf         # Optimized PostgreSQL 18 config
├── pg_hba.conf            # Client authentication config
└── pgbouncer.ini          # Connection pooling config
```

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

| Table                      | Purpose                                                      |
| -------------------------- | ------------------------------------------------------------ |
| `carts` / `cart_items`     | Shopping carts (session or customer based)                   |
| `orders` / `order_items`   | Orders with address, financial breakdown                     |
| `shipping_zones`           | Geographic regions (countries, states, cities, postal codes) |
| `shipping_methods`         | Delivery options per zone (flat, weight-based, price-based)  |
| `shipments`                | Physical shipments with tracking                             |
| `shipment_items`           | Which items in each shipment (split shipment support)        |
| `shipment_tracking_events` | Tracking history                                             |

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

### Enums

- **User roles** (`profiles.role`): `admin`, `owner`, `staff`, `customer`
- **Tenant member roles**: `owner`, `admin`, `staff`
- **Tenant status**: `pending_review`, `active`, `suspended`, `inactive`
- **Billing status**: `free_tier`, `active`, `grace_period`, `suspended`, `forgiven`
- **Order status**: `pending`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`, `refunded`, `partially_refunded`
- **Stock status**: `in_stock`, `low_stock`, `out_of_stock`, `on_backorder`
- **Shipment status**: `pending`, `picked_up`, `in_transit`, `out_for_delivery`, `delivered`, `failed`, `returned`

### Commission/Billing Model

1. **Free tier**: First 10,000 AFN in commissions is free
2. **Grace period**: 30 days to pay after exceeding free tier
3. **Active**: Paid and in good standing
4. **Forgiven**: Debt written off, store deactivated (can reactivate by paying)

## Authorization

### Role Hierarchy

- **Owner** > **Admin** > **Staff** (per-tenant via `tenant_members`)
- Global admin role via `profiles.role = 'admin'`

### RLS Policies Summary

- **Public read**: Active tenants, categories, active products, reviews, media
- **Staff+**: Create/update products, categories, media; view orders
- **Admin+**: Delete products/categories/orders; manage tenant members
- **Owner**: Update/delete tenant; manage all members

Helper functions in SQL:

- `check_tenant_access(tenant_id, role)` - Check role hierarchy
- `is_tenant_owner(tenant_id)` - Check if user owns tenant

### Auto Profile Creation

Better Auth handles profile creation automatically when users sign up.

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

## Development Notes

- **No test framework** configured yet
- **ESLint 9+** flat config in `eslint.config.mjs`
- **React Server Components** enabled by default
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

## TODO: Store Settings Features

### Completed

- [x] General settings (store name, description, currency, timezone)
- [x] Social links (Facebook, Instagram, Twitter, TikTok, WhatsApp, Telegram)
- [x] Branding settings - Logo and favicon upload with staged upload pattern
- [x] SEO settings - OG image upload with staged upload pattern
- [x] Danger zone - Deactivate/reactivate store functionality
- [x] Danger zone - Delete store permanently (with confirmation)
- [x] Team management - Add team members by email
- [x] Team management - List/manage existing team members
- [x] Team management - Remove team members
- [x] Team management - Change member roles (admin/staff)

### Pending

- [ ] Team management - Email invitations (currently requires user to have an account first)
