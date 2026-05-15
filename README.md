# Kaka Malem

A UK-based, Afghanistan-operated crypto-native escrow marketplace for cross-border trade. Connects Western buyers with white-label sellers sourcing from Chinese factories — with trustless crypto escrow as the trust layer between them.

**No banks. No Stripe. No fiat. No single point of failure.**

## How It Works

Three actors:

1. **Supplier** — Chinese factory or lab produces the goods
2. **Seller** — White-label dropshipper (e.g. foreign student in China) creates a storefront and lists products
3. **Buyer** — Western customer pays with crypto, protected by Kaka Malem escrow

**Money flow:**

```
Buyer pays crypto → Kaka Malem escrow holds funds
  → Seller ships → uploads tracking
    → Buyer confirms delivery → funds released to seller (minus 5% fee)
    → OR: No response after 30 days → auto-release to seller
    → OR: Dispute opened → admin resolves → release to winner
```

## Why It Exists

| Problem                                           | Our Answer                                     |
| ------------------------------------------------- | ---------------------------------------------- |
| Buyers don't trust anonymous Chinese suppliers    | Escrow guarantees refund if delivery fails     |
| Shopify bans certain product categories           | We don't answer to payment processors          |
| Traditional escrow is bank-based, slow, KYC-heavy | Crypto settles in minutes, no banks            |
| Alibaba Trade Assurance is clunky B2B             | Built for individual sellers and retail buyers |
| No white-label dropship platform is crypto-native | We are                                         |

## Business Model

- **Free to list** — No subscription, no upfront cost for sellers
- **5% platform fee** — Deducted automatically on escrow release, paid by seller
- **No fee for buyers** — Clean price at checkout
- **No fiat ever touches the platform** — Pure crypto-to-crypto

## Payment

**USDT on TRC20 only.** Lowest fees (~$0.30), fastest confirmation (~3s), auto-detected via TronGrid API. Custodial wallet model — all USDT sits in the platform wallet, seller balances are internal bookkeeping, on-chain transfers only happen on buyer deposit and seller withdrawal.

## Tech Stack

- **Framework**: Next.js 16 (App Router, React Server Components)
- **Database**: PostgreSQL 18 + PgBouncer + Drizzle ORM
- **Auth**: Better Auth (email/password, Google, Facebook OAuth)
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **State**: Zustand + React Query
- **Escrow**: Custodial wallet system with time-based auto-release
- **Payments**: USDT on TRC20 — crypto only, auto-detected
- **Deployment**: Docker + native PostgreSQL/Nginx/Caddy, hosted in Afghanistan

## Quick Start

```bash
pnpm install
cp .env.example .env.local
# Edit .env.local with your database credentials
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
├── admin/            # Platform admin (disputes, stores, platform fees)
├── dashboard/        # Seller dashboard
│   └── [slug]/       # Per-store management
│       ├── products/ # Product listings
│       ├── orders/   # Orders + escrow status
│       ├── earnings/ # Released funds, pending escrow, fees
│       └── settings/ # Store settings
└── store/[slug]/     # Public storefronts
    ├── (auth)/       # Buyer auth
    └── (storefront)/ # Products, cart, checkout, escrow status tracker

lib/
├── auth/             # Better Auth configuration
├── db/               # Drizzle schema and queries
├── actions/          # Server actions
├── escrow/           # Escrow logic (hold, release, dispute, auto-release)
├── payments/         # Crypto payment handling (USDT TRC20)
└── storage/          # File upload utilities

components/
├── ui/               # shadcn/ui components
├── dashboard/        # Seller dashboard components
└── store/            # Storefront + escrow status components
```

## Documentation

- [CLAUDE.md](CLAUDE.md) - Architecture and development guidelines
- [ROADMAP.md](ROADMAP.md) - Implementation plan and progress

## Deployment

UK Ltd registered entity. Servers hosted in Afghanistan for operational independence. Deploys via **Dokploy** — pushing to `main` triggers a webhook that clones the repo on the VPS and builds the Dockerfile. Environment variables and custom domain SSL are managed in the Dokploy UI.

---

> **Note on legacy infrastructure:** The codebase retains Stripe and HesabPay integrations for one existing client on the old Afghan-market SaaS model. Do not remove these — they run in parallel with the new escrow system. New features should be built for the escrow model only.
