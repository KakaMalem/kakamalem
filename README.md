# Kaka Malem

A multitenant shop builder SaaS for the Afghan market. Users can create and manage their own online stores with full e-commerce capabilities.

## Features

- **Multi-Store Management** - Create and manage multiple stores from one account
- **Full E-commerce** - Products, categories, variants, inventory tracking
- **POS System** - Point of sale with offline support (PWA)
- **Order Management** - Online and offline orders with status tracking
- **Customer Accounts** - Customer authentication, order history, wishlists
- **Shipping Zones** - Zone-based shipping with multiple rate types
- **Admin Panel** - Platform administration for store management
- **Custom Domains** - Connect your own domain with automatic SSL (Caddy)
- **SEO Optimized** - Dynamic sitemaps, robots.txt, structured data
- **Notifications** - Real-time notifications via Novu

## Tech Stack

- **Framework**: Next.js 16 (App Router, React Server Components)
- **Database**: PostgreSQL 18 + PgBouncer + Drizzle ORM
- **Auth**: Better Auth (email/password, Google, Facebook OAuth)
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **State**: Zustand (cart, checkout) + React Query (data fetching)
- **Offline**: Dexie.js (IndexedDB) + Serwist (Service Worker)
- **Notifications**: Novu
- **Deployment**: Docker + native PostgreSQL/Nginx/Caddy

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your database credentials

# Run migrations
pnpm db:migrate

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

```bash
pnpm dev          # Development server
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint

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
├── admin/            # Platform admin panel
├── dashboard/        # Store owner dashboard
│   └── [slug]/       # Per-store management
│       ├── products/ # Product management
│       ├── orders/   # Order management
│       ├── pos/      # Point of sale
│       └── settings/ # Store settings
└── store/[slug]/     # Public storefronts
    ├── (auth)/       # Store-branded customer auth
    └── (storefront)/ # Shop pages (products, cart, checkout)

lib/
├── auth/             # Better Auth configuration
├── db/               # Drizzle schema and queries
├── actions/          # Server actions
├── offline/          # Offline sync (Dexie)
└── storage/          # File upload utilities

components/
├── ui/               # shadcn/ui components
├── dashboard/        # Dashboard components
└── store/            # Storefront components
```

## Documentation

- [CLAUDE.md](CLAUDE.md) - Development guidelines and architecture
- [ROADMAP.md](ROADMAP.md) - Feature roadmap and progress
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) - Production deployment guide
- [docs/CUSTOM_DOMAINS.md](docs/CUSTOM_DOMAINS.md) - Custom domain setup
- [docs/OFFLINE_SYNC_ROADMAP.md](docs/OFFLINE_SYNC_ROADMAP.md) - Offline POS architecture

## Deployment

Push to `main` branch triggers automatic deployment via GitHub Actions with zero-downtime blue-green deployments.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full setup instructions.
