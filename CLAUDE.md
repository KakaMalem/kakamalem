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
pnpm db:generate  # Generate migrations from schema changes
pnpm db:push      # Push schema directly to database (dev only)
pnpm db:migrate   # Run migrations (production)
pnpm db:studio    # Open Drizzle Studio GUI
```

Add shadcn/ui components:

```bash
pnpm dlx shadcn-ui@latest add [component-name]
```

## Tech Stack

- **Framework**: Next.js 16 with App Router (RSC by default)
- **Language**: TypeScript 5 (strict mode)
- **Styling**: Tailwind CSS 4 with CSS variables in OKLCH color space
- **State Management**: Zustand (for client-side state like cart)
- **Database**: Supabase PostgreSQL with Drizzle ORM
- **Authentication**: Supabase Auth (email/password, Google OAuth, Facebook OAuth)
- **File Storage**: Supabase Storage (product images, shop assets)
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
├── supabase/
│   ├── client.ts           # Browser Supabase client
│   ├── server.ts           # Server Supabase client
│   ├── middleware.ts       # Session refresh middleware
│   └── auth.ts             # Server actions (signIn, signUp, signOut)
├── validations/
│   └── auth.ts             # Zod schemas for auth forms
└── utils.ts                # cn() helper for Tailwind classes

components/
├── ui/                     # shadcn/ui components
└── auth/                   # Auth-related components

supabase/
└── migrations/
    └── 001_rls_policies.sql  # RLS policies (run after db:push)
```

### Path Alias

`@/*` maps to project root. Use: `@/lib/utils`, `@/components/ui/button`

## Database Schema

### Core Tables

| Table            | Purpose                                                     |
| ---------------- | ----------------------------------------------------------- |
| `profiles`       | User profiles linked to Supabase Auth (id = auth.users.id)  |
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

Trigger on `auth.users` INSERT automatically creates `profiles` row with matching UUID.

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

### Email/Password

1. User submits form → client-side Zod validation
2. Server action validates again → calls `supabase.auth.signUp/signInWithPassword`
3. For signup: email confirmation sent → user clicks link → `/auth/callback` processes
4. Session stored in cookies via `@supabase/ssr`

### OAuth (Google/Facebook)

1. User clicks OAuth button → `supabase.auth.signInWithOAuth`
2. Redirect to provider → user authorizes
3. Callback to `/auth/callback` → exchanges code for session
4. Redirect to `/dashboard`

### Server Actions

```typescript
// lib/supabase/auth.ts
export async function signIn(formData: FormData): Promise<AuthResult>;
export async function signUp(formData: FormData): Promise<AuthResult>;
export async function signOut(): Promise<AuthResult>;
export async function getUser(): Promise<User | null>;
export async function getSession(): Promise<Session | null>;
```

## Environment Variables

Required in `.env`:

```bash
# Supabase PostgreSQL (pooled for app runtime)
DATABASE_URL="postgresql://..."

# Supabase PostgreSQL (unpooled for drizzle-kit migrations)
DATABASE_URL_UNPOOLED="postgresql://..."

# Supabase client (exposed to browser)
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
```

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
