# Kaka Malem

A multi-tenant SaaS storefront builder for Afghan businesses. Sellers create their own store, list products, accept online payments via HesabPay or cash on delivery, and manage orders, inventory, and customers from a unified dashboard.

## What it does

- **Storefronts**: each seller gets their own branded store at `kakamalem.com/store/[slug]` or a custom domain
- **Online checkout**: customers pay via HesabPay's hosted checkout or place a cash-on-delivery order
- **Order management**: track orders end-to-end, manage shipments, handle refunds
- **Inventory**: stock tracking with low-stock alerts, variants (size, color), bulk pricing tiers
- **Analytics**: revenue, top products, customer insights, sales heatmaps
- **POS / offline sales**: in-store sales recorded against the same inventory (PWA-capable for offline use)

## Business model

Subscription-based:

- **Free** — limited product count, full feature set
- **Pro (monthly / yearly)** — unlimited products, priority support. Billed via HesabPay invoices.

Sellers keep 100% of order revenue. No per-transaction fee.

## Tech Stack

- **Framework**: Next.js 16 (App Router, React Server Components)
- **Database**: PostgreSQL 18 + PgBouncer + Drizzle ORM
- **Auth**: Better Auth (email/password, Google, Facebook OAuth)
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **State**: Zustand + React Query
- **Payments**: HesabPay (hosted checkout) + COD
- **Currency**: one base currency per store (AFN by default); HesabPay always settles in AFN
- **Custom Domains**: Dokploy + Traefik (automatic SSL via Let's Encrypt)
- **Offline/PWA**: Dexie.js + Serwist (offline POS)
- **Deployment**: Dokploy on a self-hosted VPS (Docker + Traefik)

## Quick Start

```bash
pnpm install
cp .env.example .env.local
# Edit .env.local with your database credentials and HesabPay API key
pnpm db:migrate
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

```bash
pnpm dev          # Development server
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm format       # Run Prettier --write .

# Database
pnpm db:generate       # Generate migrations from schema changes
pnpm db:migrate        # Apply migrations
pnpm db:migrate:custom # Apply custom SQL (triggers, functions)
pnpm db:studio         # Open Drizzle Studio
```

## Project Structure

```
app/
├── (auth)/           # Platform auth (login, signup)
├── admin/            # Platform admin (stores, payments, affiliates, settings)
├── dashboard/        # Seller dashboard
│   └── [slug]/       # Per-store management
│       ├── products/ # Product listings
│       ├── orders/   # Orders + fulfillment
│       ├── inventory/# Stock + variants
│       ├── analytics/# Sales insights
│       ├── billing/  # Pro plan upgrade + invoices
│       └── settings/ # Store settings
└── store/[slug]/     # Public storefronts
    ├── (auth)/       # Customer auth
    └── (storefront)/ # Products, cart, checkout, account

lib/
├── auth/         # Better Auth configuration
├── db/           # Drizzle schema + queries
├── actions/      # Server actions
├── payments/     # HesabPay client + orchestrator
└── storage/     # File upload utilities

components/
├── ui/         # shadcn/ui components
├── dashboard/  # Seller dashboard components
└── store/      # Storefront components
```

## Documentation

- [CLAUDE.md](CLAUDE.md) - Architecture and development guidelines
- [ROADMAP.md](ROADMAP.md) - Implementation plan and progress

## Deployment

Deploys via **Dokploy** — pushing to `main` triggers a webhook that clones the repo on the VPS and builds the Dockerfile. Environment variables and custom domain SSL are managed in the Dokploy UI.
